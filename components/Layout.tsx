import React from 'react'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12">
      <div className="container mx-auto px-4 space-y-8">
        {/* Header Section */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">ROI Selector</h1>
          <p className="text-gray-600 text-lg">Select and categorize regions of interest in your image</p>
        </header>

        {/* Main Content */}
        {children}
      </div>
    </div>
  )
}

