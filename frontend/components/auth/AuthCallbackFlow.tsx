"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { ROUTES } from "@/config/constants";
import { authService } from "@/services/auth-service";

type Status = "loading" | "success" | "error";

function CallbackSkeleton() {
	return (
		<div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50'>
			<div className='bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center'>
				<div className='flex justify-center mb-6'>
					<div className='w-16 h-16 rounded-full bg-blue-100 animate-pulse' />
				</div>
				<div className='h-5 bg-gray-200 rounded animate-pulse mb-3 mx-auto w-48' />
				<div className='h-4 bg-gray-100 rounded animate-pulse mx-auto w-36' />
			</div>
		</div>
	);
}

function AuthCallbackContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [status, setStatus] = useState<Status>("loading");
	const [errorMessage, setErrorMessage] = useState<string>("Something went wrong. Please try again.");
	const [countdown, setCountdown] = useState(3);

	useEffect(() => {
		const handleCallback = async () => {
			try {
				const code = searchParams.get("code");
				const oauthError = searchParams.get("error");

				// Remove sensitive query params from the URL before session establishment.
				if (typeof window !== "undefined" && window.location.search) {
					window.history.replaceState({}, document.title, window.location.pathname);
				}

				if (oauthError) {
					setErrorMessage("Authentication was cancelled or denied.");
					setStatus("error");
					return;
				}

				if (!code) {
					setErrorMessage("No OAuth exchange code was received.");
					setStatus("error");
					return;
				}

				const exchange = await authService.exchangeOAuthCode(code);

				const result = await signIn("oauth-token", {
					token: exchange.accessToken,
					refreshToken: exchange.refreshToken,
					redirect: false,
				});

				if (result?.error) {
					setErrorMessage("We couldn't create your session. Please try again.");
					setStatus("error");
					return;
				}

				setStatus("success");
				toast.success("You're signed in!");
				setTimeout(() => router.push(ROUTES.DASHBOARD), 1200);
			} catch (err: any) {
				console.error("OAuth callback error:", err);
				setErrorMessage(err.message || "Authentication failed. Please try again.");
				setStatus("error");
			}
		};

		handleCallback();
	}, [searchParams, router]);

	useEffect(() => {
		if (status !== "error") return;
		if (countdown <= 0) {
			router.push(ROUTES.LOGIN);
			return;
		}
		const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
		return () => clearTimeout(timer);
	}, [status, countdown, router]);

	return (
		<div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4'>
			<div className='bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center'>
				{status === "loading" && (
					<>
						<div className='flex justify-center mb-6'>
							<div className='relative w-16 h-16'>
								<div className='absolute inset-0 rounded-full border-4 border-blue-100' />
								<div className='absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin' />
							</div>
						</div>
						<h1 className='text-xl font-semibold text-gray-900 mb-2'>Signing you in...</h1>
						<p className='text-sm text-gray-500'>Please wait while we securely complete your login.</p>
					</>
				)}

				{status === "success" && (
					<>
						<div className='flex justify-center mb-6'>
							<div className='w-16 h-16 rounded-full bg-green-100 flex items-center justify-center'>
								<svg
									className='w-8 h-8 text-green-600'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
									strokeWidth={2.5}>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M5 13l4 4L19 7'
									/>
								</svg>
							</div>
						</div>
						<h1 className='text-xl font-semibold text-gray-900 mb-2'>You're in!</h1>
						<p className='text-sm text-gray-500'>Redirecting you to your dashboard...</p>
						<div className='mt-5 h-1 w-full bg-gray-100 rounded-full overflow-hidden'>
							<div className='h-1 bg-green-500 rounded-full animate-[progress_1.2s_ease-in-out_forwards]' />
						</div>
					</>
				)}

				{status === "error" && (
					<>
						<div className='flex justify-center mb-6'>
							<div className='w-16 h-16 rounded-full bg-red-100 flex items-center justify-center'>
								<svg
									className='w-8 h-8 text-red-500'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
									strokeWidth={2.5}>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</div>
						</div>
						<h1 className='text-xl font-semibold text-gray-900 mb-2'>Authentication Failed</h1>
						<p className='text-sm text-gray-500 mb-6'>{errorMessage}</p>

						<Link
							href={ROUTES.LOGIN}
							className='inline-flex items-center justify-center w-full gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'>
							Back to Login
						</Link>

						<p className='mt-4 text-xs text-gray-400'>
							Redirecting automatically in <span className='font-semibold text-gray-600'>{countdown}s</span>...
						</p>
					</>
				)}
			</div>
		</div>
	);
}

export default function AuthCallbackFlow() {
	return (
		<Suspense fallback={<CallbackSkeleton />}>
			<AuthCallbackContent />
		</Suspense>
	);
}
