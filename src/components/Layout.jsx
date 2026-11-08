import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  FileText,
  FileCheck,
  FileMinus,
  FilePlus,
  FileQuestion,
  ShoppingCart,
  CreditCard,
  BarChart3,
  PieChart,
  ClipboardList,
  Building2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

const navGroups = [
  {
    label: 'MAIN',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'MASTER DATA',
    items: [
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Suppliers', path: '/suppliers', icon: Truck },
      { name: 'Products', path: '/products', icon: Package },
    ],
  },
  {
    label: 'SALES',
    items: [
      { name: 'Tax Invoice', path: '/invoices', icon: FileText },
      { name: 'Bill of Supply', path: '/bill-of-supply/new', icon: FileCheck },
      { name: 'Credit Note', path: '/credit-notes/new', icon: FileMinus },
      { name: 'Debit Note', path: '/debit-notes/new', icon: FilePlus },
      { name: 'Quotations', path: '/quotations', icon: FileQuestion },
    ],
  },
  {
    label: 'PURCHASE',
    items: [
      { name: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { name: 'Payments', path: '/payments', icon: CreditCard },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { name: 'GSTR-1', path: '/reports/gstr1', icon: BarChart3 },
      { name: 'GSTR-3B', path: '/reports/gstr3b', icon: PieChart },
      { name: 'HSN Summary', path: '/reports/hsn', icon: ClipboardList },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { name: 'Company Profile', path: '/company', icon: Building2 },
    ],
  },
];

const pageTitles = {
  '/': 'Dashboard',
  '/company': 'Company Profile',
  '/customers': 'Customers',
  '/customers/new': 'Add Customer',
  '/suppliers': 'Suppliers',
  '/suppliers/new': 'Add Supplier',
  '/products': 'Products',
  '/products/new': 'Add Product',
  '/invoices': 'Invoices',
  '/invoices/new': 'New Tax Invoice',
  '/bill-of-supply/new': 'New Bill of Supply',
  '/credit-notes/new': 'New Credit Note',
  '/debit-notes/new': 'New Debit Note',
  '/quotations': 'Quotations',
  '/quotations/new': 'New Quotation',
  '/purchase-orders': 'Purchase Orders',
  '/purchase-orders/new': 'New Purchase Order',
  '/payments': 'Payments',
  '/reports/gstr1': 'GSTR-1 Report',
  '/reports/gstr3b': 'GSTR-3B Report',
  '/reports/hsn': 'HSN Summary Report',
};

function getPageTitle(pathname) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (/^\/customers\/\d+\/edit$/.test(pathname)) return 'Edit Customer';
  if (/^\/suppliers\/\d+\/edit$/.test(pathname)) return 'Edit Supplier';
  if (/^\/products\/\d+\/edit$/.test(pathname)) return 'Edit Product';
  if (/^\/invoices\/\d+\/edit$/.test(pathname)) return 'Edit Invoice';
  if (/^\/invoices\/\d+$/.test(pathname)) return 'Invoice Details';
  if (/^\/quotations\/\d+\/edit$/.test(pathname)) return 'Edit Quotation';
  if (/^\/quotations\/\d+$/.test(pathname)) return 'Quotation Details';
  if (/^\/purchase-orders\/\d+\/edit$/.test(pathname)) return 'Edit Purchase Order';
  if (/^\/purchase-orders\/\d+$/.test(pathname)) return 'Purchase Order Details';
  return 'GST Billing';
}

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const pageTitle = getPageTitle(location.pathname);

  const isNavActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Company name */}
      <div className="flex items-center h-16 px-4 border-b border-gray-700/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">GST</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">GST Billing</h1>
              <p className="text-[10px] text-gray-400 truncate">Software</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                      ${active
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }
                    `}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden lg:block border-t border-gray-700/50 p-3 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="ml-2 text-sm">Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 ease-in-out lg:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-[-44px] w-9 h-9 flex items-center justify-center rounded-full bg-gray-900 text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[70px]' : 'w-[260px]'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ease-in-out
          ${collapsed ? 'lg:ml-[70px]' : 'lg:ml-[260px]'}
        `}
      >
        {/* Top header bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-16 flex items-center px-4 sm:px-6 shadow-sm">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden mr-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-semibold text-gray-800 truncate">{pageTitle}</h2>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
