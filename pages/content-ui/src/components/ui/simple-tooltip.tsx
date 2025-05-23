import React, { useState, useRef, useEffect } from 'react';

interface SimpleTooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
}

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({ content, children, delay = 300 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [position, setPosition] = useState<{ left?: string; right?: string; transform?: string }>({ left: '50%', transform: 'translateX(-50%)' });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const readyTimeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const containerWidth = window.innerWidth;
    
    // 计算居中位置
    const centerLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
    const rightEdge = centerLeft + tooltipRect.width;
    
    // 检查是否超出右边界
    if (rightEdge > containerWidth - 16) { // 留16px边距
      // 超出右边界，使用右对齐
      setPosition({ 
        left: 'auto', 
        transform: 'none',
        right: '0px'
      });
    } else if (centerLeft < 16) { // 检查是否超出左边界
      // 超出左边界，使用左对齐
      setPosition({ 
        left: '0px', 
        transform: 'none'
      });
    } else {
      // 正常居中
      setPosition({ 
        left: '50%', 
        transform: 'translateX(-50%)'
      });
    }
  };

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // 等待DOM渲染完成后计算位置并显示
      readyTimeoutRef.current = setTimeout(() => {
        calculatePosition();
        setIsReady(true);
      }, 16);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    setIsVisible(false);
    setIsReady(false);
    setPosition({ left: '50%', transform: 'translateX(-50%)' }); // 重置位置
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    };
  }, []);
  return (
    <div 
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="absolute top-full mt-2 z-[99999]"
          style={{
            ...position,
            opacity: isReady ? 1 : 0,
            backgroundColor: '#1e293b',
            color: '#ffffff',
            padding: '4px 8px', // 更小的padding
            borderRadius: '3px',
            fontSize: '12px',   // 更小的字体
            fontWeight: '500',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            transition: 'opacity 0.2s ease-out',
            pointerEvents: 'none'
          }}
        >
          {content}
          <div 
            style={{
              position: 'absolute',
              bottom: '100%',
              left: position.left === '50%' ? '50%' : position.left === '0px' ? '10px' : 'auto',
              right: position.right ? '10px' : 'auto',
              transform: position.left === '50%' ? 'translateX(-50%)' : 'none',
              width: 0,
              height: 0,
              borderLeft: '3px solid transparent',
              borderRight: '3px solid transparent',
              borderBottom: '3px solid #1e293b'
            }}
          />
        </div>
      )}
    </div>
  );
};

export { SimpleTooltip };
