'use client'
import { useState } from 'react';
import Image from 'next/image';
import Button from '@/app/components/Button';
import { useRouter } from 'next/navigation';

interface LoginMethod {
    id:string;
    label:string;
    icon: string;
    iconWidth: number;
    iconHeight: number;
    disabled?: boolean;
    comingSoon?: boolean;

}

const LoginPage: React.FC = () =>{

    const router = useRouter();
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const loginMethods : LoginMethod[] = [
        {
            id:'username',
            label:'Username & Password',
            icon:'/images/img_icon.svg',
            iconWidth:30,
            iconHeight:34
        },
        {
            id:'license',
            label:"Driver's License",
            icon: '/images/img_license_icon.svg',
            iconWidth:46,
            iconHeight:34
        },
        {
            id:'fingerprint',
            label:'Fingerprint',
            icon:'/images/img_fingerprint_scan.svg',
            iconWidth:44,
            iconHeight:44,
            comingSoon:true
        }
    ];

    const handlePatientSignup = () => {
        // Handle patient signup navigation
        router.push('/patient-register');
    };
    const handleEMTAccess = async () => {
        setLoading('emt');
        // Simulate EMT access processing
        await new Promise(resolve => setTimeout(resolve, 1500));
        setLoading(null);
        console.log('EMT Access initiated');
    };
    const handleLoginMethod = async (methodId: string) => {
        if (methodId === 'fingerprint') return; // Disabled method
        setSelectedMethod(methodId);
        setLoading(methodId);
        // Simulate authentication process
        await new Promise(resolve => setTimeout(resolve, 1000));
        setLoading(null);
        console.log(`Login with ${methodId}`);
    };

    return (
    <div className="min-h-screen bg-[#11306a] flex flex-col">
      {/* Header with Patient Signup */}
      <div className="flex justify-end p-4 sm:p-6 lg:p-12">
        <Button
          onClick={handlePatientSignup}
          variant="primary"
          size="lg"
          className="bg-[#5b9eff] text-white hover:bg-blue-600 rounded-[10px] px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl lg:text-2xl font-semibold"
        >
          Patient Signup
        </Button>
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl text-center">
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold text-white mb-4 sm:mb-6 lg:mb-8 font-inter leading-tight">
            MediConnect
          </h1>
          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-8 sm:mb-12 lg:mb-16 max-w-3xl mx-auto leading-relaxed">
            Secure Patient Access in Moments that Matter
          </p>
          {/* Login Options Container */}
          <div className="w-full max-w-md mx-auto space-y-12 sm:space-y-16 lg:space-y-20">
            {/* EMT Access Button */}
            <Button
              onClick={handleEMTAccess}
              loading={loading === 'emt'}
              variant="primary"
              size="xl"
              className="w-full bg-[#5b9eff] text-white hover:bg-blue-600 rounded-[14px] px-6 sm:px-8 lg:px-12 py-4 sm:py-5 lg:py-6 text-2xl sm:text-3xl lg:text-4xl font-bold shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border border-black flex items-center justify-center gap-4 sm:gap-5 lg:gap-6 min-h-[80px] sm:min-h-[86px]"
            >
              <Image
                src="/images/img_group_111.svg"
                alt="EMT Access"
                width={52}
                height={44}
                className="w-10 h-8 sm:w-12 sm:h-10 lg:w-[52px] lg:h-[44px]"
              />
              EMT Access
            </Button>
            {/* Login Methods */}
            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              {loginMethods.map((method) => (
                <div key={method.id} className="relative">
                  {method.comingSoon ? (
                    // Fingerprint with Coming Soon
                    <div className="w-full bg-[#f4f4f8] rounded-[10px] p-3 sm:p-4 lg:p-5 flex items-center justify-between min-h-[60px] sm:min-h-[70px] lg:min-h-[80px]">
                      <div className="flex items-center gap-4 sm:gap-5 lg:gap-6">
                        <Image
                          src={method.icon}
                          alt={method.label}
                          width={method.iconWidth}
                          height={method.iconHeight}
                          className="w-8 h-8 sm:w-10 sm:h-10 lg:w-[44px] lg:h-[44px]"
                        />
                        <span className="text-[#1f3454] text-xl sm:text-2xl lg:text-3xl font-normal">
                          {method.label}
                        </span>
                      </div>
                      <div className="bg-[#f4f4f8] border border-[#1100d7] rounded-[10px] px-3 py-2 text-black text-sm sm:text-base lg:text-lg">
                        Coming soon!
                      </div>
                    </div>
                  ) : (
                    // Regular login method buttons
                    <Button
                      onClick={() => router.push('/patient-login')}
                      variant="secondary"
                      size="xl"
                      className={`
                        w-full bg-[#f4f4f8] text-[#1f3454] hover:bg-gray-200 rounded-[10px] 
                        px-6 sm:px-8 lg:px-12 py-3 sm:py-4 lg:py-5 
                        text-xl sm:text-2xl lg:text-3xl font-normal 
                        flex items-center justify-start gap-4 sm:gap-5 lg:gap-6 
                        min-h-[60px] sm:min-h-[70px] lg:min-h-[80px]
                        ${selectedMethod === method.id ? 'ring-2 ring-blue-500' : ''}
                      `}
                    >
                      <Image
                        src={method.icon}
                        alt={method.label}
                        width={method.iconWidth}
                        height={method.iconHeight}
                        className="w-6 h-6 sm:w-8 sm:h-8 lg:w-[30px] lg:h-[34px] flex-shrink-0"
                      />
                      {method.label}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Spacing */}
      <div className="h-16 sm:h-20 lg:h-24"></div>
    </div>
  );
}

export default LoginPage;