import React, { useContext, useEffect, useState } from 'react';
import Icon from '../../../../library/icon/icon.jsx';
import CartContext from '../../../../context/cart-context.jsx';
import ApiConstants from '../../../../api/api.constants.js';
import '../../../cart/components/aura-details/aura-details.css';
import './aura-details.css';
import {
  getEnrolledStatus,
} from '../../../../api/auraDetails.js';

function AuraDetails({
  orderItems,
  customerDetails,
  auraChecked,
  setAuraChecked,
  isShowHideBorder = true,
}) {
  const {
    placeholders, isLoggedIn, configs, setAuraAccountData,
  } = useContext(CartContext);

  const [apcData, setApcData] = useState({});
  const [auraLinked, setAuraLinked] = useState(false);
  const [enrolledData, setEnrolledData] = useState({});
  const isCLMDowntime = configs['clm-downtime'] === 'true';
  const currency = configs.currency || 'AED';

  const earnedPoints = Number(orderItems?.auraEarnedPoints) || 0;
  const redeemedPoints = Number(orderItems?.auraRedeemedPoints) || 0;
  const savedPoints = Number(orderItems?.auraSavedPoints) || 0;

  const {
    auraBannerUserMessage = '',
    auraJoinNow = '',
    accountToLink = '',
    auraPoints = '',
    cartAuraClmDowtimeText = '',
    auraEarned = '',
    auraSaved = '',
    auraRedeemed = '',
    auraCreditText = '',
    auraMobileNumber = '',
    linkAuraLabel = '',
    collectAuraPointsLabel = '',
    pleaseLinkAuraLabel = '',
    auraGuestNotLinkedText = '',
  } = placeholders;

  async function getLocalData() {
    const auraDetails = JSON.parse(localStorage.getItem('aura_common_data')) || {};
    setAuraLinked(Number(auraDetails.aura_link));
    setApcData({
      apc_identifier_number: auraDetails.aura_membership,
      name: auraBannerUserMessage.replace(
        'X',
        auraDetails.aura_user_first_name,
      ),
    });
  }

  useEffect(() => {
    getLocalData();
  }, []);

  useEffect(() => {
    (async () => {
      if (customerDetails?.email) {
        const endpoint = ApiConstants.API_URI_GET_ENROLLED_AURA.replace('{{searchedType}}', 'email').replace('{{inputValue}}', customerDetails.email);
        const enrolledStatus = await getEnrolledStatus(endpoint, isLoggedIn);
        if (enrolledStatus.apc_identifier_number) {
          setAuraAccountData(enrolledStatus);
          enrolledStatus.message = auraGuestNotLinkedText.replace('X', enrolledStatus.apc_identifier_number);
          setEnrolledData(enrolledStatus);
        }
      }
    })();
  }, [customerDetails?.email]);

  const openJoinORLinkAuraModal = (type) => {
    if (type === 'join') {
      window.dispatchEvent(new CustomEvent('react:handleJoinAura'));
    } else {
      window.dispatchEvent(new CustomEvent('react:handleLinkAura'));
    }
    window.addEventListener('linkAuraSuccess', () => {
      getLocalData();
    }, { once: true });
  };
  // This will be enabled if none of this true in testing
  // if (
  //   !(
  //     apcData?.apc_identifier_number &&
  //     (auraLinked === 2 || auraLinked === 3) &&
  //     earnedPoints > 0
  //   )
  // )
  //   return;

  return (
    <div className={`cart-aura-details-container ${isShowHideBorder ? 'border-false' : ''}`}>
      <div className="aura-header">
        {isCLMDowntime
          && (
            <div className="info info--flex">
              <Icon
                name="auraicon"
                className="icon icon--small"
              />

              <p className="aura-offline">
                {cartAuraClmDowtimeText}
              </p>

            </div>
          )}
        {!isCLMDowntime && (
          <>
            <div className="info">
              {!isLoggedIn && (
                <input type="checkbox" checked={auraChecked} onChange={() => setAuraChecked((prev) => !prev)} />
              )}
              <Icon name="cart-aura" className="icon" />
            </div>
            <div className="points-details">
              {redeemedPoints > 0 && auraLinked === 2 && (
                <div className="box">
                  {auraRedeemed}
                  {' '}
                  <span>{redeemedPoints}</span>
                  {' '}
                  {auraPoints}
                </div>
              )}
              {savedPoints > 0 && (
                <div className="box">
                  {auraSaved}
                  {' '}
                  {currency}
                  {' '}
                  <span>{savedPoints}</span>
                </div>
              )}
              {earnedPoints > 0 && (
                <div className="box">
                  {auraEarned}
                  {' '}
                  <span>{earnedPoints}</span>
                  {' '}
                  {auraPoints}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {!isCLMDowntime && (
        <div className="aura-body">
          {!isLoggedIn && !apcData?.apc_identifier_number && (
            <div className="guest-aura-info">
              <div className="guest-aura-info-otp-text info">
                {' '}
                {enrolledData.message ? enrolledData.message : placeholders.joinAuraText}
              </div>
              <div className="info">
                {' '}
                {placeholders.joinAuraOtpText}
                {' '}
              </div>
              <div>
                {' '}
                <div className="guest-aura-mobile-number">
                  {auraMobileNumber}
                  {' '}
                  <span className="guest-aura-info-otp-text">
                    {customerDetails?.phoneNumber}
                  </span>
                </div>
              </div>
            </div>
          )}
          {apcData?.apc_identifier_number
            && (auraLinked === 2 || auraLinked === 3)
            && earnedPoints > 0 && <div className="content">{auraCreditText}</div>}
          {((apcData?.apc_identifier_number && auraLinked === 1)
            || (!apcData?.apc_identifier_number
              && (auraLinked === null || auraLinked === 0)))
            && isLoggedIn && (
              <div className="content content--flex">
                <div className="content-left">
                  <div className="aura-link-text">
                    <strong>{collectAuraPointsLabel}</strong>
                    {apcData?.apc_identifier_number && pleaseLinkAuraLabel}
                  </div>
                  {apcData?.apc_identifier_number && (
                    <div className="link-account-chip">
                      <span className="link-account-chip-label">
                        {accountToLink}
                      </span>
                      <span className="link-account-chip-value">
                        {apcData.apc_identifier_number
                          .match(/.{1,4}/g)
                          .join(' ')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="content-right">
                  <div className="links-container">
                    <span onClick={() => openJoinORLinkAuraModal('link')}>
                      {linkAuraLabel}
                    </span>
                  </div>
                  {!apcData?.apc_identifier_number && (
                    <div className="links-container">
                      <span onClick={() => openJoinORLinkAuraModal('join')}>
                        {auraJoinNow}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export default AuraDetails;
