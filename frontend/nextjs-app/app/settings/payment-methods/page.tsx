import { PaymentMethods } from '@/components/features/payment/PaymentMethods';

export default function PaymentMethodsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Payment Methods</h1>
      
      <PaymentMethods />
    </div>
  );
}
