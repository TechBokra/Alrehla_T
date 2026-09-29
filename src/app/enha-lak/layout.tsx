import React from 'react';
import { SectionSubNav } from '@/components/SectionSubNav';

const enhaLakTabs = [
  { name: 'نظرة عامة', href: '/enha-lak' },
  { name: 'أنت البطل هنا', href: '/enha-lak/custom' },
  { name: 'المكتبة العامة', href: '/enha-lak/library' },
  { name: 'صندوق الرحلة', href: '/enha-lak/subscription' },
];



export default async function EnhaLakLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#FFFBFD] to-[#FDF5F7] selection:bg-rose-200 selection:text-rose-900">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-rose-200/40 to-fuchsia-200/40 blur-[100px]" />
        <div className="absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full bg-gradient-to-bl from-violet-200/30 to-purple-200/30 blur-[100px]" />
      </div>
      
      <div className="relative z-10">
        <SectionSubNav tabs={enhaLakTabs} activeColorClass="bg-rose-700 text-white" />
        
        {/* الشرائح كانت هنا، يعني بتظهر فوق **كل** صفحة في القسم —
            وده مزعج في صفحات زي المكتبة والدفع. بقت في صفحة القسم
            الرئيسية وحدها. */}
        
        {children}
      </div>
    </div>
  );
}
