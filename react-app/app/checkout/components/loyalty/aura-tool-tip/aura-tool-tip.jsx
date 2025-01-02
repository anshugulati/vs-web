import React, { useEffect, useRef, useState } from 'react';
import './aura-tool-tip.css';
import Icon from '../../../../../library/icon/icon.jsx';

function AuraToolTip({
  data, type, content, newClass, salesPoints,
}) {

  const offSetRef = useRef(null)
  const [isLeftAlign, setIsLeftAlign] = useState(false)
  useEffect(() => {
    const lang = document.documentElement.lang;
    const handleAlignment = () => {
      if (offSetRef?.current) {
        const tooltipRect = offSetRef.current.getBoundingClientRect();
        const viewPort = window?.innerWidth
        // Check if tooltip overflows the viewport to the right
        if (lang === 'en' && tooltipRect.right + tooltipRect.left > viewPort
          || lang === 'ar' && tooltipRect.right + tooltipRect.left - tooltipRect.width < viewPort) {
          setIsLeftAlign(false);
        } else {
          setIsLeftAlign(true);
        }
      }
    };
    // Call alignment logic on component mount and window resize
    handleAlignment();
    window.addEventListener('resize', handleAlignment);

    // Cleanup event listener
    return () => {
      window.removeEventListener('resize', handleAlignment);
    };
  }, []);
  return (
    <div className={`aura-tool-tip ${newClass || ''} ${isLeftAlign && `position-left`}`} ref={offSetRef}>
      <span className="aura-tool-tip__title">
        {data}
      </span>
      <div className="aura-tool-tip__wrapper">
        {
          newClass
            ? (<span className={newClass}></span>)
            : (<Icon name={type} className="aura-tool-tip__icon" />)
        }
        <span className="aura-tool-tip__info-value blue-bg">
          {content}
        </span>
      </div>
    </div>
  );
}
export default AuraToolTip;
