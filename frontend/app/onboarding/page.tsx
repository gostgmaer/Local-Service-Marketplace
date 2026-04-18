"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Permission } from "@/utils/permissions";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/config/constants";
import {
  createProviderProfile,
  getProviderProfileByUserId,
} from "@/services/user-service";
import { requestService } from "@/services/request-service";
import { apiClient } from "@/services/api-client";
import { authService } from "@/services/auth-service";
import { toast } from "react-hot-toast";
import {
	CheckCircle,
	User,
	Briefcase,
	ArrowRight,
	ArrowLeft,
	Clock,
	Mail,
	Phone,
	ShieldCheck,
	AlertTriangle,
	RefreshCw,
	Upload,
	FileText,
	X,
} from "lucide-react";

const PROVIDER_STEPS = [
	"welcome",
	"verify-contact",
	"profile",
	"services",
	"availability",
	"documents",
	"complete",
] as const;

const DOCUMENT_TYPES = [
	{ value: "government_id", label: "Government ID", hint: "Aadhaar, PAN, Passport, Driving License" },
	{ value: "business_license", label: "Business License", hint: "GST certificate, Shop Act license" },
	{ value: "certification", label: "Skill Certification", hint: "Trade certificate, diploma, etc." },
	{ value: "insurance_certificate", label: "Insurance Certificate", hint: "Professional liability insurance" },
	{ value: "tax_document", label: "Tax Document", hint: "ITR, Form 26AS, etc." },
] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];
const CUSTOMER_STEPS = ["welcome", "complete"] as const;
type ProviderStep = (typeof PROVIDER_STEPS)[number];
type CustomerStep = (typeof CUSTOMER_STEPS)[number];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface AvailabilitySlot {
  day: string;
  start_time: string;
  end_time: string;
}

function OnboardingContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectReason = searchParams.get("reason");
	const { data: session, update: updateSession } = useSession();
	const { user } = useAuth();
	const { can } = usePermissions();
	const [step, setStep] = useState<ProviderStep | CustomerStep>("welcome");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const resumeChecked = useRef(false);

	// Step: Documents
	const [uploadedDocs, setUploadedDocs] = useState<Array<{ type: DocumentType; file: File; name: string }>>([]);
	const [uploadingDoc, setUploadingDoc] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedDocType, setSelectedDocType] = useState<DocumentType>("government_id");

	// Step: Verify Contact
	const [resendLoading, setResendLoading] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(0);
	const [refreshingStatus, setRefreshingStatus] = useState(false);
	// Local override: set when a direct API check confirms verification
	// (guards against stale session data after email verification)
	const [localEmailVerified, setLocalEmailVerified] = useState<boolean | null>(null);
	const [localPhoneVerified, setLocalPhoneVerified] = useState<boolean | null>(null);

	// Derive live verification flags — prefer local override over session
	const emailVerified = localEmailVerified ?? Boolean(session?.user?.emailVerified);
	const phoneVerified = localPhoneVerified ?? Boolean(session?.user?.phoneVerified);
	const contactVerified = emailVerified || phoneVerified;

	// Auto-advance from verify-contact step as soon as verification is confirmed
	useEffect(() => {
		if (step === "verify-contact" && contactVerified) {
			goNext();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [contactVerified, step]);

	// Step: Profile
	const [businessName, setBusinessName] = useState("");
	const [description, setDescription] = useState("");
	const [phone, setPhone] = useState("");
	const [gstin, setGstin] = useState("");

	// Step: Services
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

	// Step: Availability
	const [availability, setAvailability] = useState<AvailabilitySlot[]>([
		{ day: "Monday", start_time: "09:00", end_time: "17:00" },
		{ day: "Tuesday", start_time: "09:00", end_time: "17:00" },
		{ day: "Wednesday", start_time: "09:00", end_time: "17:00" },
		{ day: "Thursday", start_time: "09:00", end_time: "17:00" },
		{ day: "Friday", start_time: "09:00", end_time: "17:00" },
	]);

	const isProvider = can(Permission.PROVIDER_PROFILE_VIEW);
	const steps = isProvider ? PROVIDER_STEPS : CUSTOMER_STEPS;
	const currentIndex = steps.indexOf(step as any);

	// Sync local verification state whenever the session updates
	// (e.g. after returning from the verify-email page)
	useEffect(() => {
		if (session?.user?.emailVerified) setLocalEmailVerified(true);
		if (session?.user?.phoneVerified) setLocalPhoneVerified(true);
	}, [session?.user?.emailVerified, session?.user?.phoneVerified]);

	// On mount: detect how far the provider got and resume from first incomplete step
	useEffect(() => {
		if (!isProvider || !user?.id || resumeChecked.current) return;
		resumeChecked.current = true;

		(async () => {
			try {
				// Must have verified contact first
				if (!contactVerified) {
					setStep("verify-contact");
					return;
				}

				const profile = await getProviderProfileByUserId(user.id);
				if (!profile) {
					setStep("profile");
					return;
				}

				// Profile exists — check services
				const servicesRes = await apiClient.get(`/providers/${profile.id}/services`).catch(() => ({ data: [] }));
				const servicesList: any[] = Array.isArray(servicesRes.data) ? servicesRes.data : (servicesRes.data?.data ?? []);
				if (servicesList.length === 0) {
					setStep("services");
					return;
				}

				// Services done — check availability
				const availRes = await apiClient.get(`/providers/${profile.id}/availability`).catch(() => ({ data: [] }));
				const availList: any[] = Array.isArray(availRes.data) ? availRes.data : (availRes.data?.data ?? []);
				if (availList.length === 0) {
					setStep("availability");
					return;
				}

				// Availability done — check documents
				const docsRes = await apiClient.get(`/provider-documents/provider/${profile.id}`).catch(() => ({ data: [] }));
				const docsList: any[] = Array.isArray(docsRes.data) ? docsRes.data : (docsRes.data?.data ?? []);
				if (docsList.length === 0) {
					setStep("documents");
					return;
				}

				// Everything done — go to complete
				setStep("complete");
			} catch {
				// On any error fall through to welcome
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isProvider, user?.id]);

	const { data: categories } = useQuery({
		queryKey: ["categories"],
		queryFn: () => requestService.getCategories(),
		enabled: isProvider,
	});

	const goNext = () => {
		const next = steps[currentIndex + 1];
		if (next) setStep(next);
	};

	const goBack = () => {
		const prev = steps[currentIndex - 1];
		if (prev) setStep(prev);
	};

	const handleResendVerificationEmail = async () => {
		if (!user?.email || resendCooldown > 0) return;
		setResendLoading(true);
		try {
			await authService.resendVerificationEmail(user.email);
			toast.success("Verification email sent! Check your inbox.");
			// 60-second cooldown
			setResendCooldown(60);
			const timer = setInterval(() => {
				setResendCooldown((prev) => {
					if (prev <= 1) {
						clearInterval(timer);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		} catch {
			toast.error("Failed to send verification email. Please try again.");
		} finally {
			setResendLoading(false);
		}
	};

	const handleRefreshVerificationStatus = async () => {
		setRefreshingStatus(true);
		try {
			// Direct API call to get fresh verification status, bypassing potentially
			// stale session data (session update mechanism can silently fail)
			const profile = await authService.getProfile();
			const freshEmailVerified = Boolean(profile?.email_verified);
			const freshPhoneVerified = Boolean(profile?.phone_verified);
			setLocalEmailVerified(freshEmailVerified);
			setLocalPhoneVerified(freshPhoneVerified);
			// Also persist to NextAuth session for middleware and other pages
			await updateSession({ force: true });
			if (freshEmailVerified || freshPhoneVerified) {
				toast.success("Verified! Continuing...");
			} else {
				toast("Email not verified yet. Please check your inbox.");
			}
		} catch {
			toast.error("Could not refresh status. Please try again.");
		} finally {
			setRefreshingStatus(false);
		}
	};

	const handleProfileSubmit = async () => {
		if (isProvider) {
			if (!businessName.trim() || !description.trim()) {
				toast.error("Please fill in business name and description");
				return;
			}
			setIsSubmitting(true);
			try {
				await createProviderProfile({ business_name: businessName.trim(), description: description.trim() });
				toast.success("Profile created!");
				goNext();
			} catch (err: any) {
				const msg: string = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || "";
				// If profile already exists, treat as success and continue
				if (msg.toLowerCase().includes("already exists")) {
					toast.success("Profile already set up. Continuing...");
					goNext();
				} else {
					toast.error("Failed to create profile. Please try again.");
				}
			} finally {
				setIsSubmitting(false);
			}
		} else {
			goNext();
		}
	};

	const handleServicesSubmit = async () => {
		if (selectedCategories.length === 0) {
			toast.error("Please select at least one service");
			return;
		}
		setIsSubmitting(true);
		try {
			const provider = await getProviderProfileByUserId(user!.id);
			if (!provider) {
				toast.error("Provider profile not found.");
				return;
			}
			await Promise.all(
				selectedCategories.map((catId) =>
					apiClient.post(`/providers/${provider.id}/services`, { category_id: catId }).catch(() => null),
				),
			);
			toast.success("Services saved!");
			goNext();
		} catch {
			toast.error("Failed to save services.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDocumentAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		// 10MB limit
		if (file.size > 10 * 1024 * 1024) {
			toast.error("File size must be under 10MB");
			return;
		}
		setUploadedDocs((prev) => [
			...prev.filter((d) => d.type !== selectedDocType),
			{ type: selectedDocType, file, name: file.name },
		]);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleDocumentsSubmit = async () => {
		if (uploadedDocs.length === 0) {
			toast.error("Please upload at least one document");
			return;
		}
		setUploadingDoc(true);
		try {
			const profile = await getProviderProfileByUserId(user!.id);
			if (!profile) {
				toast.error("Provider profile not found.");
				return;
			}
			const results = await Promise.allSettled(
				uploadedDocs.map((doc) => {
					const formData = new FormData();
					formData.append("files", doc.file);
					formData.append("document_type", doc.type);
					formData.append("document_name", doc.name);
					return apiClient.post(`/provider-documents/upload/${profile.id}`, formData, {
						headers: { "Content-Type": "multipart/form-data" },
					});
				}),
			);
			const failed = results.filter((r) => r.status === "rejected");
			if (failed.length > 0) {
				toast.error(`${failed.length} document(s) failed to upload. Please try again.`);
				return;
			}
			toast.success("Documents uploaded!");
			goNext();
		} catch {
			toast.error("Upload failed. Please try again.");
		} finally {
			setUploadingDoc(false);
		}
	};

	const handleAvailabilitySubmit = async () => {
		setIsSubmitting(true);
		try {
			const provider = await getProviderProfileByUserId(user!.id);
			if (!provider) {
				toast.error("Provider profile not found.");
				return;
			}
			// Backend expects PATCH with { availability: [...slots] }
			await apiClient.patch(`/providers/${provider.id}/availability`, {
				availability: availability.map((slot) => ({
					day_of_week: DAYS.indexOf(slot.day),
					start_time: slot.start_time,
					end_time: slot.end_time,
				})),
			});
			toast.success("Availability saved!");
			goNext();
		} catch {
			toast.error("Failed to save availability.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const toggleDay = (day: string) => {
		setAvailability((prev) => {
			if (prev.find((s) => s.day === day)) return prev.filter((s) => s.day !== day);
			return [...prev, { day, start_time: "09:00", end_time: "17:00" }];
		});
	};

	const updateSlot = (day: string, field: "start_time" | "end_time", value: string) => {
		setAvailability((prev) => prev.map((s) => (s.day === day ? { ...s, [field]: value } : s)));
	};

	return (
		<Layout>
			<div className='min-h-[80vh] flex items-center justify-center py-12 px-4'>
				<div className='w-full max-w-lg'>
					{/* Redirect reason banner */}
					{redirectReason === "verify_contact" && (
						<div className='flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 mb-6 text-sm'>
							<AlertTriangle className='h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5' />
							<div>
								<p className='font-semibold text-amber-800 dark:text-amber-300'>Verification required</p>
								<p className='text-amber-700 dark:text-amber-400 mt-0.5'>
									You need to verify your email or phone before you can access provider features. Please complete the
									steps below.
								</p>
							</div>
						</div>
					)}

					{redirectReason === "pending_admin_review" && (
						<div className='flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 p-4 mb-6 text-sm'>
							<Clock className='h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5' />
							<div>
								<p className='font-semibold text-blue-800 dark:text-blue-300'>Account under review</p>
								<p className='text-blue-700 dark:text-blue-400 mt-0.5'>
									Your account is pending admin approval. You will be able to submit proposals and access provider
									features once your account has been verified. This usually takes 1–2 business days.
								</p>
							</div>
						</div>
					)}

					{/* Progress */}
					<div className='flex items-center justify-center gap-2 mb-8'>
						{steps.map((s, i) => (
							<div
								key={s}
								className='flex items-center gap-2'>
								<div
									className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
										i <= currentIndex ? "bg-primary-600 text-white" : (
											"bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
										)
									}`}>
									{i < currentIndex ?
										<CheckCircle className='h-5 w-5' />
									:	i + 1}
								</div>
								{i < steps.length - 1 && (
									<div
										className={`w-10 h-0.5 ${i < currentIndex ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"}`}
									/>
								)}
							</div>
						))}
					</div>

					{/* Step: Welcome */}
					{step === "welcome" && (
						<Card>
							<CardHeader>
								<div className='text-center'>
									<div className='mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4'>
										{isProvider ?
											<Briefcase className='h-8 w-8 text-primary-600' />
										:	<User className='h-8 w-8 text-primary-600' />}
									</div>
									<h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
										Welcome, {user?.name || "there"}!
									</h1>
									<p className='mt-2 text-gray-600 dark:text-gray-400'>
										{isProvider ?
											"Let's set up your provider profile in a few quick steps so customers can find and hire you."
										:	"Let's get you started finding great local services."}
									</p>
								</div>
							</CardHeader>
							<CardContent>
								{isProvider && (
									<div className='grid grid-cols-2 gap-3 mb-6 text-sm'>
										{["Verify contact", "Business profile", "Services offered", "Availability", "Upload documents"].map(
											(item, i) => (
												<div
													key={i}
													className='flex items-center gap-2 text-gray-600 dark:text-gray-400'>
													<div className='w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-xs font-bold'>
														{i + 1}
													</div>
													{item}
												</div>
											),
										)}
									</div>
								)}
								<Button
									className='w-full'
									onClick={goNext}>
									Get Started <ArrowRight className='h-4 w-4 ml-2' />
								</Button>
							</CardContent>
						</Card>
					)}

					{/* Step: Verify Contact (Provider only) */}
					{step === "verify-contact" && (
						<Card>
							<CardHeader>
								<div className='flex items-center gap-3 mb-1'>
									<ShieldCheck className='h-6 w-6 text-primary-600 flex-shrink-0' />
									<h2 className='text-xl font-bold text-gray-900 dark:text-white'>Verify Your Contact</h2>
								</div>
								<p className='text-sm text-gray-600 dark:text-gray-400'>
									You must verify your email or phone number before you can start providing services.
								</p>
							</CardHeader>
							<CardContent className='space-y-4'>
								{/* Email verification */}
								<div
									className={`rounded-lg border p-4 ${emailVerified ? "border-green-400 bg-green-50 dark:bg-green-900/20" : "border-amber-400 bg-amber-50 dark:bg-amber-900/20"}`}>
									<div className='flex items-center gap-3 mb-2'>
										<Mail className={`h-5 w-5 flex-shrink-0 ${emailVerified ? "text-green-600" : "text-amber-600"}`} />
										<div className='flex-1'>
											<p className='text-sm font-medium text-gray-900 dark:text-white'>Email Address</p>
											<p className='text-xs text-gray-500 dark:text-gray-400'>{user?.email}</p>
										</div>
										{emailVerified ?
											<span className='flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400'>
												<CheckCircle className='h-4 w-4' /> Verified
											</span>
										:	<span className='text-xs font-medium text-amber-700 dark:text-amber-400'>Pending</span>}
									</div>
									{!emailVerified && (
										<div className='mt-3 space-y-2'>
											<p className='text-xs text-amber-700 dark:text-amber-300'>
												A verification link was sent when you registered. Check your inbox and spam folder.
											</p>
											<Button
												variant='outline'
												size='sm'
												onClick={handleResendVerificationEmail}
												isLoading={resendLoading}
												disabled={resendCooldown > 0}
												className='w-full text-xs'>
												{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Verification Email"}
											</Button>
										</div>
									)}
								</div>

								{/* Phone verification status */}
								<div
									className={`rounded-lg border p-4 ${phoneVerified ? "border-green-400 bg-green-50 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40"}`}>
									<div className='flex items-center gap-3'>
										<Phone className={`h-5 w-5 flex-shrink-0 ${phoneVerified ? "text-green-600" : "text-gray-400"}`} />
										<div className='flex-1'>
											<p className='text-sm font-medium text-gray-900 dark:text-white'>Phone Number</p>
											<p className='text-xs text-gray-500 dark:text-gray-400'>
												{phoneVerified ? "Verified via OTP" : "Not yet verified — you can verify from Settings later"}
											</p>
										</div>
										{phoneVerified && (
											<span className='flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400'>
												<CheckCircle className='h-4 w-4' /> Verified
											</span>
										)}
									</div>
								</div>

								{/* Refresh status button */}
								<Button
									variant='outline'
									size='sm'
									onClick={handleRefreshVerificationStatus}
									isLoading={refreshingStatus}
									className='w-full text-xs'>
									<RefreshCw className='h-3.5 w-3.5 mr-1.5' />
									I&apos;ve verified — refresh status
								</Button>

								{!contactVerified && (
									<div className='flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300'>
										<AlertTriangle className='h-4 w-4 flex-shrink-0 mt-0.5' />
										<span>You must verify your email or phone before continuing. Please check your inbox.</span>
									</div>
								)}

								<div className='flex gap-3 pt-2'>
									<Button
										variant='outline'
										onClick={goBack}
										className='flex-1'>
										<ArrowLeft className='h-4 w-4 mr-2' /> Back
									</Button>
									<Button
										onClick={goNext}
										className='flex-1'
										disabled={!contactVerified}>
										Continue <ArrowRight className='h-4 w-4 ml-2' />
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Step: Profile (Provider) */}
					{step === "profile" && (
						<Card>
							<CardHeader>
								<h2 className='text-xl font-bold text-gray-900 dark:text-white'>Set Up Your Business Profile</h2>
								<p className='text-sm text-gray-600 dark:text-gray-400'>
									This is what customers will see when they browse providers
								</p>
							</CardHeader>
							<CardContent>
								<div className='space-y-4'>
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											Business Name *
										</label>
										<input
											type='text'
											value={businessName}
											onChange={(e) => setBusinessName(e.target.value)}
											placeholder="e.g. Joe's Plumbing Services"
											className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500'
										/>
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											Phone Number
										</label>
										<input
											type='tel'
											value={phone}
											onChange={(e) => setPhone(e.target.value)}
											placeholder='+91 98765 43210'
											className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500'
										/>
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											GSTIN <span className='text-gray-400 font-normal'>(optional)</span>
										</label>
										<input
											type='text'
											value={gstin}
											onChange={(e) => setGstin(e.target.value.toUpperCase())}
											placeholder='e.g. 27AAPFU0939F1ZV'
											maxLength={15}
											className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 font-mono'
										/>
										<p className='text-xs text-gray-400 mt-1'>Your GST Identification Number for tax invoices</p>
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											Business Description *
										</label>
										<textarea
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											rows={5}
											placeholder='Describe your services, experience, and what makes you stand out...'
											className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 resize-none'
										/>
										<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>{description.length}/500 characters</p>
									</div>
								</div>
								<div className='flex gap-3 mt-6'>
									<Button
										variant='outline'
										onClick={goBack}
										className='flex-1'>
										<ArrowLeft className='h-4 w-4 mr-2' /> Back
									</Button>
									<Button
										onClick={handleProfileSubmit}
										isLoading={isSubmitting}
										className='flex-1'>
										Save & Continue <ArrowRight className='h-4 w-4 ml-2' />
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Step: Services */}
					{step === "services" && (
						<Card>
							<CardHeader>
								<h2 className='text-xl font-bold text-gray-900 dark:text-white'>What Services Do You Offer?</h2>
								<p className='text-sm text-gray-600 dark:text-gray-400'>
									Select all that apply â€” you can change these later
								</p>
							</CardHeader>
							<CardContent>
								<div className='grid grid-cols-2 gap-2 mb-6 max-h-72 overflow-y-auto pr-1'>
									{(categories ?? []).map((cat: any) => {
										const selected = selectedCategories.includes(cat.id);
										return (
											<button
												key={cat.id}
												onClick={() =>
													setSelectedCategories((prev) =>
														selected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id],
													)
												}
												className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
													selected ?
														"border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
													:	"border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-300"
												}`}>
												{selected && <CheckCircle className='h-4 w-4 flex-shrink-0' />}
												{cat.name}
											</button>
										);
									})}
								</div>
								<p className='text-sm text-gray-500 mb-4'>
									{selectedCategories.length} service
									{selectedCategories.length !== 1 ? "s" : ""} selected
								</p>
								<div className='flex gap-3'>
									<Button
										variant='outline'
										onClick={goBack}
										className='flex-1'>
										<ArrowLeft className='h-4 w-4 mr-2' /> Back
									</Button>
									<Button
										onClick={handleServicesSubmit}
										isLoading={isSubmitting}
										className='flex-1'
										disabled={selectedCategories.length === 0}>
										Save & Continue <ArrowRight className='h-4 w-4 ml-2' />
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Step: Availability */}
					{step === "availability" && (
						<Card>
							<CardHeader>
								<h2 className='text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
									<Clock className='h-5 w-5 text-primary-600' /> Set Your Availability
								</h2>
								<p className='text-sm text-gray-600 dark:text-gray-400'>
									Toggle days on/off and set your working hours
								</p>
							</CardHeader>
							<CardContent>
								<div className='space-y-3 mb-6'>
									{DAYS.map((day) => {
										const slot = availability.find((s) => s.day === day);
										const active = !!slot;
										return (
											<div
												key={day}
												className={`flex items-center gap-3 p-3 rounded-lg border ${active ? "border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10" : "border-gray-200 dark:border-gray-700"}`}>
												<button
													onClick={() => toggleDay(day)}
													className={`w-10 h-5 rounded-full transition-colors relative ${active ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-600"}`}>
													<span
														className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? "left-5" : "left-0.5"}`}
													/>
												</button>
												<span
													className={`w-24 text-sm font-medium ${active ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
													{day}
												</span>
												{active && (
													<div className='flex items-center gap-2 text-sm'>
														<input
															type='time'
															value={slot.start_time}
															onChange={(e) => updateSlot(day, "start_time", e.target.value)}
															className='px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-xs'
														/>
														<span className='text-gray-400'>to</span>
														<input
															type='time'
															value={slot.end_time}
															onChange={(e) => updateSlot(day, "end_time", e.target.value)}
															className='px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white text-xs'
														/>
													</div>
												)}
											</div>
										);
									})}
								</div>
								<div className='flex gap-3'>
									<Button
										variant='outline'
										onClick={goBack}
										className='flex-1'>
										<ArrowLeft className='h-4 w-4 mr-2' /> Back
									</Button>
									<Button
										onClick={handleAvailabilitySubmit}
										isLoading={isSubmitting}
										className='flex-1'
										disabled={availability.length === 0}>
										Save & Continue <ArrowRight className='h-4 w-4 ml-2' />
									</Button>
								</div>
								<button
									onClick={goNext}
									className='w-full mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'>
									Skip for now
								</button>
							</CardContent>
						</Card>
					)}

					{/* Step: Documents */}
					{step === "documents" && (
						<Card>
							<CardHeader>
								<h2 className='text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
									<FileText className='h-5 w-5 text-primary-600' /> Upload Verification Documents
								</h2>
								<p className='text-sm text-gray-600 dark:text-gray-400'>
									Upload at least one ID or business document. Our team reviews these to verify your account.
								</p>
							</CardHeader>
							<CardContent className='space-y-4'>
								{/* Document type selector */}
								<div>
									<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
										Document Type
									</label>
									<select
										value={selectedDocType}
										onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
										className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500'>
										{DOCUMENT_TYPES.map((dt) => (
											<option
												key={dt.value}
												value={dt.value}>
												{dt.label}
											</option>
										))}
									</select>
									<p className='text-xs text-gray-400 mt-1'>
										{DOCUMENT_TYPES.find((d) => d.value === selectedDocType)?.hint}
									</p>
								</div>

								{/* File picker */}
								<div
									onClick={() => fileInputRef.current?.click()}
									className='border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors'>
									<Upload className='h-8 w-8 text-gray-400 mx-auto mb-2' />
									<p className='text-sm font-medium text-gray-700 dark:text-gray-300'>Click to select file</p>
									<p className='text-xs text-gray-400 mt-1'>PDF, JPG, PNG up to 10MB</p>
									<input
										ref={fileInputRef}
										type='file'
										accept='.pdf,.jpg,.jpeg,.png'
										className='hidden'
										onChange={handleDocumentAdd}
									/>
								</div>

								{/* Uploaded docs list */}
								{uploadedDocs.length > 0 && (
									<div className='space-y-2'>
										<p className='text-sm font-medium text-gray-700 dark:text-gray-300'>Selected documents:</p>
										{uploadedDocs.map((doc) => (
											<div
												key={doc.type}
												className='flex items-center gap-3 px-3 py-2 rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 text-sm'>
												<CheckCircle className='h-4 w-4 text-green-600 flex-shrink-0' />
												<div className='flex-1 min-w-0'>
													<p className='font-medium text-gray-900 dark:text-white truncate'>{doc.name}</p>
													<p className='text-xs text-gray-500'>
														{DOCUMENT_TYPES.find((d) => d.value === doc.type)?.label}
													</p>
												</div>
												<button
													onClick={() => setUploadedDocs((prev) => prev.filter((d) => d.type !== doc.type))}
													className='text-gray-400 hover:text-red-500'>
													<X className='h-4 w-4' />
												</button>
											</div>
										))}
									</div>
								)}

								<div className='flex gap-3 pt-2'>
									<Button
										variant='outline'
										onClick={goBack}
										className='flex-1'>
										<ArrowLeft className='h-4 w-4 mr-2' /> Back
									</Button>
									<Button
										onClick={handleDocumentsSubmit}
										isLoading={uploadingDoc}
										disabled={uploadedDocs.length === 0}
										className='flex-1'>
										Upload & Continue <ArrowRight className='h-4 w-4 ml-2' />
									</Button>
								</div>
								<button
									onClick={goNext}
									className='w-full mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'>
									Skip for now
								</button>
							</CardContent>
						</Card>
					)}

					{/* Step: Complete */}
					{step === "complete" && (
						<Card>
							<CardHeader>
								<div className='text-center'>
									<div className='mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4'>
										<CheckCircle className='h-8 w-8 text-green-600' />
									</div>
									<h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
										{isProvider ? "Setup Complete!" : "You're All Set!"}
									</h2>
									<p className='mt-2 text-gray-600 dark:text-gray-400'>
										{isProvider ?
											"Your provider profile has been submitted. We will review your documents before you can accept jobs."
										:	"Your account is ready. Browse available services or create a request."}
									</p>
								</div>
							</CardHeader>
							<CardContent>
								{isProvider ?
									<div className='space-y-4'>
										{/* Pending admin verification notice */}
										<div className='flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4'>
											<AlertTriangle className='h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5' />
											<div className='text-sm'>
												<p className='font-semibold text-amber-800 dark:text-amber-300 mb-1'>
													Document Verification Pending
												</p>
												<p className='text-amber-700 dark:text-amber-400'>
													Your profile is under review by our team. You will be notified once verified. Until then you
													can browse requests and prepare proposals, but you cannot accept jobs or receive payments.
												</p>
											</div>
										</div>

										{/* What you can do now */}
										<div className='rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-800 dark:text-blue-300'>
											<p className='font-semibold mb-2'>While you wait, you can:</p>
											<ul className='space-y-1 list-disc list-inside text-xs'>
												<li>Browse open service requests from customers</li>
												<li>Submit proposals on relevant jobs (held until verified)</li>
												<li>Complete your profile and upload KYC documents</li>
												<li>Set your availability and service areas</li>
											</ul>
										</div>

										<Button
											className='w-full'
											onClick={() => router.push("/dashboard/provider")}>
											Go to Provider Dashboard <ArrowRight className='h-4 w-4 ml-2' />
										</Button>
										<Button
											variant='outline'
											className='w-full'
											onClick={() => router.push("/dashboard/browse-requests")}>
											Browse Service Requests
										</Button>
									</div>
								:	<Button
										className='w-full'
										onClick={() => router.push(ROUTES.DASHBOARD)}>
										Go to Dashboard <ArrowRight className='h-4 w-4 ml-2' />
									</Button>
								}
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</Layout>
	);
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
