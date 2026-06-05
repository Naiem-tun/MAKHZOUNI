import React from 'react';

const originalCreateElement = React.createElement;
const originalJsx = (React as any).jsx;
const originalJsxs = (React as any).jsxs;

function trackKeys(type: any, props: any, ...children: any[]) {
  if (Array.isArray(children)) {
    const keys = new Set();
    children.forEach((child: any) => {
      if (child && child.key != null) {
        if (keys.has(child.key)) {
          console.error(`💥 DUPLICATE KEY DETECTED! Key: "${child.key}", Component: ${typeof type === 'string' ? type : type?.name || type?.displayName || 'Unknown'}`);
        }
        keys.add(child.key);
      }
    });
  }
}

// Monkey patch
(React as any).createElement = function (type: any, props: any, ...children: any[]) {
  trackKeys(type, props, ...children);
  return originalCreateElement.apply(this, [type, props, ...children]);
};

if (originalJsx) {
  (React as any).jsx = function (type: any, props: any, key: any) {
    if (props && props.children && Array.isArray(props.children)) {
       trackKeys(type, props, ...props.children);
    }
    return originalJsx.apply(this, [type, props, key]);
  };
}

if (originalJsxs) {
  (React as any).jsxs = function (type: any, props: any, key: any) {
    if (props && props.children && Array.isArray(props.children)) {
       trackKeys(type, props, ...props.children);
    }
    return originalJsxs.apply(this, [type, props, key]);
  };
}
