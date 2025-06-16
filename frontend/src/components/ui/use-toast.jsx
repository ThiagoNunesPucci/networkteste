import React from 'react';

const Toast = ({ children, ...props }) => {
  return <div {...props}>{children}</div>;
};

const useToast = () => {
  return {
    toast: ({ title, description, variant }) => {
      console.log(`Toast: ${title} - ${description} (${variant})`);
    }
  };
};

export { Toast, useToast };

