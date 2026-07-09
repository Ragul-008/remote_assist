import React from 'react';
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { motion } from 'framer-motion';

const Placeholder = () => {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop()?.replace('-', ' ') || 'Page';

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-md w-full"
      >
        <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-6">
          <Construction className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize mb-2">
          {pageName}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          This section is currently under construction. Check back soon!
        </p>
      </motion.div>
    </div>
  );
};

export default Placeholder;
