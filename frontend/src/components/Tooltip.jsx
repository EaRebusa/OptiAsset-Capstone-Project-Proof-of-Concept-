import React from 'react';

const Tooltip = ({ children, text }) => {
    return (
        <div className="relative flex items-center group">
            {children}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-slate-800 text-white text-xs rounded-lg py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
        </div>
    );
};

export default Tooltip;