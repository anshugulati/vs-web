import React, {
  useContext,
} from 'react';
import './progress-bar.css';
import CartContext from '../../context/cart-context.jsx';
import Icon from './../../library/icon/icon.jsx';

const createItemClasses = (item, active) => {
  const classes = [];
  if (active === item.id) {
    classes.push('active');
  }
  if (item.isClickable && item.id !== active) {
    classes.push('clickable');
  }
  if (item.id < active) {
    classes.push('completed');
  }
  return classes;
};

function ProgressBar({shouldDisableAllSteps = false}) {
  const { activeProgressStep, placeholders, isLoggedIn, configs } = useContext(CartContext);
  const showOrderConfirmationProgressBarTickMark = configs['show-order-confirmation-progress-bar-tick-mark'] === 'true';
  const redirectUrl = `cart/login?redirect=/${document.documentElement.lang}/checkout`;
  const progress = [
    {
      id: 1, label: placeholders?.bagLabel, isClickable: !shouldDisableAllSteps, url: `/${document.documentElement.lang}/cart`,
    },
    {
      id: 2, label: placeholders?.signInLabel, isClickable: !shouldDisableAllSteps && !(isLoggedIn && activeProgressStep === 3), url: `/${document.documentElement.lang}/${isLoggedIn ? 'checkout' : redirectUrl}`,
    },
    {
      id: 3, label: placeholders?.deliveryPaymentLabel, isClickable: !shouldDisableAllSteps && isLoggedIn, url: `/${document.documentElement.lang}/checkout`,
    },
    { id: 4, label: placeholders?.confirmationLabel, isClickable: false },
  ];

  const renderNumber = (id) => {
    if (id < activeProgressStep || (showOrderConfirmationProgressBarTickMark && activeProgressStep === 4)) {
      return <Icon name='tick-complete' />;
    }
    return id;
  };

  return (
    <div className="progress__bar-container">
      {progress.map((p) => (
        <div key={p.id} className={`progress__bar-item ${createItemClasses(p, activeProgressStep).join(' ')}`}>
          <div className="progress__bar-item-number">
            <div className="progress__bar-item-number-wrapper">
              {p.isClickable && p.id !== activeProgressStep ? (
                <a className="progress__bar-item-number-div" href={p.url}>
                  <div className="progress__bar-item-check-wrapper">{renderNumber(p.id)}</div>
                </a>
              ) : (
                <div className="progress__bar-item-number-div">
                  <div className="progress__bar-item-check-wrapper">{renderNumber(p.id)}</div>
                </div>
              )}

            </div>
          </div>
          <div className="progress__bar-item-label-wrapper">
            {p.isClickable && p.id !== activeProgressStep ? <a className="progress__bar-item-label" href={p.url}>{p.label}</a> : <div className="progress__bar-item-label">{p.label}</div> }
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProgressBar;
