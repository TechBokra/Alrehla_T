import React from 'react';
import { SectionSubNav } from '@/components/SectionSubNav';

const creativeWritingTabs = [
  { name: 'نظرة عامة', href: '/creative-writing' },
  { name: 'عن البرنامج', href: '/creative-writing/about' },
  { name: 'الباقات', href: '/creative-writing/packages' },
  { name: 'المدربون', href: '/creative-writing/instructors' },
  { name: 'الخدمات الإبداعية', href: '/creative-writing/services' },
];



export default async function CreativeWritingLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#F8FAF9] to-[#F1F6F4] selection:bg-emerald-200 selection:text-emerald-900">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 h-px w-1/2 bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-emerald-100/30 to-teal-100/30 blur-[100px]" />
      </div>
      
      <div className="relative z-10">
        <SectionSubNav tabs={creativeWritingTabs} activeColorClass="bg-emerald-700 text-white" />
        
        {/* الشرائح كانت هنا، يعني بتظهر فوق **كل** صفحة في القسم —
            وده مزعج في صفحات زي المكتبة والدفع. بقت في صفحة القسم
            الرئيسية وحدها. */}

        {children}
      </div>
    </div>
  );
}
