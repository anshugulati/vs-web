import React, {
  useContext, useEffect, useState, useMemo,
} from 'react';
import Icon from '../../../../library/icon/icon.jsx';
import CartContext from '../../../../context/cart-context.jsx';
import ApiConstants from '../../../../api/api.constants.js';
import './aura-details.css';
import {
  getApcPointsBalance,
  simulateSales,
} from '../../../../api/auraDetails.js';
import updateCart from '../../../../api/updateCart.js';
import getSubCartGraphql from '../../../../api/getSubCartGraphql.js';
import useGetAuraOffers from '../../../../api/getAuraOffers.js';
import AppConstants from '../../../../utils/app.constants.js';
import Loader from '../../../../shared/loader/loader.jsx';
import Dialog from '../../../../shared/dialog/dialog.jsx';

function AuraDetails() {
  const {
    placeholders, isLoggedIn, cartId, cart, auraOffers, setPromotion, setAuraOffers, promotion, couponCode, configs,
  } = useContext(CartContext);

  const [earnPoints, setEarnPoints] = useState();
  const [apcBalance, setApcBalance] = useState({});
  const [apcData, setApcData] = useState({});
  const [auraLinked, setAuraLinked] = useState(false);
  const memeberDiscount = cart?.data?.extension_attributes?.cart.extension_attributes?.member_price_discount;
  const isAuraProductPresent = cart?.data?.extension_attributes?.cart?.items?.some((item) => item.extension_attributes.member_price !== null);
  const isCLMDowntime = configs['clm-downtime'] === 'true';
  const currency = configs.currency || 'AED';
  const showAuraOffers = configs[
    'aura-promotions-enabled'] === 'true';

  const [offersCount, setOffersCount] = useState({
    totalOffersCount: 0,
    activatedOffersCount: 0,
  });
  const [allProductsOOS, setAllProductsOOS] = useState(false);
  const [showOffersApplied, setShowOffersApplied] = useState(false);
  const [isAuraLoading, setIsAuraLoading] = useState(true);
  const [modalView, setModalView] = useState(false);
  const [activeTab, setActiveTab] = useState('offers');
  const [offerErrorMessage, setErrorMessageOffer] = useState([]);

  const {
    auraBannerUserMessage = '',
    auraInfoAboutRegistration = '',
    auraInfoGuest = '',
    auraLinkNow = '',
    auraJoinNow = '',
    pointsExpiryText = '',
    accountToLink = '',
    auraSaveLabel = '',
    auraEarn = '',
    auraPoints = '',
    cartAuraClmDowtimeText = '',
    auraSignIn = '',
    auraOfferText = '',
    auraActivatedText = '',
    auraAddMemberOffers = '',
    auraAvailable = '',
    auraOffersText = '',
    auraModalOffersTitle = '',
    auraModalOffersActivated = '',
    auraSelectOffers = '',
    auraApply = '',
    auraExpiry = '',
    auraActivated = '',
    auraOfferAutomaticText = '',

  } = placeholders;

  const { qrOffers, activatedOffers } = auraOffers || {};

  const qrOffersData = qrOffers?.coupons?.length;
  const activatedOffersData = activatedOffers?.accepted_offer?.length;

  const isEnrolled = useMemo(() => {
    if (isLoggedIn) {
      return (auraLinked === 2 || auraLinked === 3);
    }
    return auraLinked;
  }, [isLoggedIn, auraLinked]);

  async function getLocalData() {
    const auraDetails = JSON.parse(localStorage.getItem('aura_common_data')) || {};
    const endpoint = isLoggedIn ? ApiConstants.API_URI_SIMULATE_SALES_AURA.replace('{{identifierNo}}', auraDetails?.aura_membership) : ApiConstants.API_URI_GUEST_CART_SIMILATE_SALES_AURA;
    const details = await simulateSales(endpoint, isLoggedIn, cartId);
    setEarnPoints(details.data.apc_points);
    setAuraLinked(Number(auraDetails.aura_link));
    setApcData({ apc_identifier_number: auraDetails.aura_membership, name: auraBannerUserMessage.replace('X', auraDetails.aura_user_first_name) });
    setIsAuraLoading(false);
  }

  useEffect(() => {
    getLocalData();
  }, []);

  useEffect(() => {
    const onGetCustomerData = async (event) => {
      const customer = event?.detail?.response;
      if (customer) {
        const apcBalanceEndPoint = ApiConstants.API_URI_APC_CUSTOMER_BALANCE_POINTS.replace(
          '{{customerId}}',
          customer.id,
        );
        const apcBalanceDetails = await getApcPointsBalance(
          apcBalanceEndPoint,
          isLoggedIn,
        );
        const options = {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          numberingSystem: 'latn',
        };
        function onGetFormatDate({ detail: { value } }) {
          value.then((data) => {
            apcBalanceDetails.apc_points_expiry_date = data;
            setApcBalance(apcBalanceDetails);
          });
        }
        window.addEventListener('react:handleFormatDateResult', onGetFormatDate, { once: true });
        window.dispatchEvent(
          new CustomEvent('react:handleFormatDate', {
            detail: {
              message: {
                expiryDate: apcBalanceDetails.apc_points_expiry_date,
                options,
              },
            },
          }),
        );

        const apaAuraDataEndPoint = ApiConstants.API_URI_APC_CUSTOMER_AURA_DATA.replace(
          '{{customerId}}',
          customer.id,
        );
        const apcDetails = await getApcPointsBalance(
          apaAuraDataEndPoint,
          isLoggedIn,
        );
        apcDetails.name = auraBannerUserMessage.replace(
          'X',
          apcDetails.apc_first_name,
        );
        setApcData(apcDetails);
        setIsAuraLoading(false);
      }
    };
    window.addEventListener('react:getCustomerResult', onGetCustomerData, { once: true });
    if (isLoggedIn) {
      window.dispatchEvent(new CustomEvent('react:getCustomer'));
    }
  }, [isLoggedIn]);
  // To determine if a user has valid offers to grab in the Members offers banner
  useEffect(() => {
    if (isLoggedIn && auraLinked === 2 && showAuraOffers) {
      setIsAuraLoading(true);
      const cartItems = cart?.data?.extension_attributes?.cart?.items;
      const anyItemInStock = cartItems.find(
        (cartItem) => cartItem?.extension_attributes?.error_message === null
          || !cartItem?.extension_attributes?.error_message?.includes(
            AppConstants?.OOS_TEXT,
          ),
      );

      if (!anyItemInStock) setAllProductsOOS(true);

      (async () => {
        const offers = await useGetAuraOffers();

        // Check for the offers and add the lengths to get the total count to display along with Available text
        if (offers?.qrOffers?.coupons !== null) {
          setOffersCount((prev) => ({
            ...prev,
            totalOffersCount:
              prev?.totalOffersCount + offers?.qrOffers?.coupons?.length,
          }));
        }

        if (offers?.activatedOffers?.accepted_offer !== null) {
          setOffersCount((prev) => ({
            ...prev,
            totalOffersCount:
              prev?.totalOffersCount
              + offers?.activatedOffers?.accepted_offer?.length,
            activatedOffersCount:
              offers?.activatedOffers?.accepted_offer?.length,
          }));
        }

        // Set the context variable to reuse in popup
        setAuraOffers(offers);

        // Check if any Aura offer is already applied
        if (
          couponCode
          && ((offers?.qrOffers?.coupons !== null
            && offers?.qrOffers?.coupons?.find(
              (coupon) => coupon?.code === couponCode,
            ))
            || (offers?.activatedOffers?.accepted_offer !== null
              && offers?.activatedOffers?.accepted_offer?.find(
                (offer) => offer?.code === couponCode,
              )))
        ) {
          setShowOffersApplied(true);
        }
        setIsAuraLoading(false);
      })();
    }
  }, [isLoggedIn, auraLinked, showAuraOffers]);

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

  const openOffers = () => {
    setModalView(true);
  };

  const handleClose = () => {
    setModalView(false);
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
  };

  console.log(couponCode, 'coupun code');
  const getUpdatedCart = async () => {
    const result = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PRICES, ApiConstants.CART_QUERY__EXTENSION_ATTRIBUTE]);
    if (result) {
      setCart({ ...cart, data: { ...cart?.data, ...result } });
      await Tamara.isAvailable({ ...cart, data: { ...cart?.data, ...result } }, setTamaraAvailable, isLoggedIn);
    }
  };

  const handleApplyOffer = async (code, offerId) => {
    console.log(code, 'coupun code');
    if (code) {
      setPromotion({ ...promotion, isApplyingPromoCode: false, errorMessage: '' });
      const request = {
        extension: {
          action: 'apply coupon',
        },
        coupon: code,
      };
      const result = await updateCart(request, cartId, isLoggedIn);
      if (result.response_message?.[1] === 'success') {
        window.dispatchEvent(
          new CustomEvent('react:dataLayerPromoCodeEvent', {
            detail: {
              couponCode: code,
              couponStatus: 'pass',
            },
          }),
        );
        setAppliedPromoCode(code);
        await getUpdatedCart();
        setErrorMessageOffer((prev) => ({ ...prev, [offerId]: '' }));
      }
      if (result.response_message?.[1] === 'error_coupon') {
        const errorMessageCoupon = result.response_message?.[0];
        setErrorMessageOffer((prev) => ({ ...prev, [offerId]: errorMessageCoupon }));
        window.dispatchEvent(
          new CustomEvent('react:dataLayerPromoCodeEvent', {
            detail: {
              couponCode: code,
              couponStatus: 'fail',
            },
          }),
        );

        window.dispatchEvent(
          new CustomEvent('react:dataLayerCartErrorsEvent', {
            detail: {
              eventLabel: code,
              eventAction: result.response_message?.[0],
              eventPlace: `Error occured on ${window.location.href}`,
              couponCode: code,
            },
          }),
        );
      }
      setPromotion({
        ...promotion,
        isApplyingPromoCode: false,

      });
    } else {
      window.dispatchEvent(
        new CustomEvent('react:dataLayerPromoCodeEvent', {
          detail: {
            couponCode: code,
            couponStatus: 'fail',
          },
        }),
      );
      setPromotion({ ...promotion, errorMessage: placeholders.promotionRequiredValidationErrorMessage });
    }
  };

  return (
    <div
      className={`cart-aura-details-container ${isCLMDowntime ? 'cart-aura-details-container--aura-offline' : ''}`}
    >

      <div className="aura-header">
        <div className={`info ${isCLMDowntime ? 'info--flex' : ''}`}>
          <Icon
            name={isCLMDowntime ? 'auraicon' : 'cart-aura'}
            className={`icon ${isCLMDowntime ? 'icon--small' : ''}`}
          />
          {isCLMDowntime && (
            <p className="aura-offline">
              {cartAuraClmDowtimeText}
            </p>
          )}
        </div>
        {!isCLMDowntime && (
          <div className="points-details">
            {apcData?.apc_identifier_number && memeberDiscount && isAuraProductPresent ? (
              <div className="box">
                {currency}
                {' '}
                <span>{memeberDiscount}</span>
                {' '}
                {auraSaveLabel}
              </div>
            ) : null}
            {isAuraProductPresent && (
              <div className="box">
                {auraEarn}
                {' '}
                <span>{earnPoints}</span>
                {' '}
                {auraPoints}
              </div>
            )}
          </div>
        )}

      </div>
      {
        isAuraLoading && (
        <div className="aura-body">
          <div className="content loading">
            <Loader />
            {' '}
          </div>
        </div>
        )
      }
      {!isCLMDowntime && !isAuraLoading && (
        <div className="aura-body">
          {apcData?.apc_identifier_number && isEnrolled ? (
            <>
              <div className="aura-body-content">
                <div className="content">{apcData.name}</div>
                {apcBalance.apc_points_to_expire
                  && apcBalance.apc_points_expiry_date && (
                    <div className="error-warning">
                      {apcBalance.apc_points_to_expire}
                      {' '}
                      {pointsExpiryText}
                      {' '}
                      {apcBalance.apc_points_expiry_date}
                    </div>
                )}
              </div>
              {/* When aura is not fully enrolled show a message */}
              {auraLinked === 3 && (
                <div className="aura-footer">
                  <div className="content">{auraInfoAboutRegistration}</div>
                </div>
              )}
              {isLoggedIn
                && auraLinked === 2
                && offersCount?.totalOffersCount !== 0
                && showAuraOffers ? (
                  <div className="aura-footer">
                    <div
                      className={`content add-members ${allProductsOOS ? 'disabled' : ''}`}
                      onClick={openOffers}
                    >
                      {offersCount?.activatedOffersCount > 0 ? (
                        <div className="add-members-text">
                          {showOffersApplied ? '1 offer applied and ' : ''}
                          {offersCount?.activatedOffersCount}
                          {' '}
                          {auraOfferText}
                          {offersCount?.activatedOffersCount > 1 ? 's' : ''}
                          {' '}
                          {auraActivatedText}
                        </div>
                      ) : (
                        <div className="add-members-text">{auraAddMemberOffers}</div>
                      )}
                      <div className="add-members-offers" onClick={openOffers}>
                        <span className="add-members-offers-number">
                          {offersCount?.totalOffersCount}
                        </span>
                        <span className="add-members-offers-text">
                          {auraAvailable}
                        </span>
                        <span className="add-members-offers-icon">
                          <Icon name="chevron-right-black" />
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

              {modalView && (
              <div className="aura-offers-dialog">
                <Dialog isOpen onClose={handleClose}>
                  <div>

                    <div className="offer-header">
                      <div className="aura-offer-popup-title">{auraOffersText}</div>
                    </div>
                    <div className="offer-tabs">

                      {qrOffersData && (
                      <div
                        className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
                        onClick={() => handleTabSwitch('offers')}
                      >
                        <span className="add-members-offers-number">
                          {qrOffersData}
                        </span>
                        {' '}
                        {auraModalOffersTitle}
                      </div>
                      )}
                      {activatedOffersData && (
                      <div
                        className={`tab ${activeTab === 'activateOffers' ? 'active' : ''}`}
                        onClick={() => handleTabSwitch('activateOffers')}
                      >
                        <span className="add-members-offers-number">
                          {activatedOffersData}
                        </span>
                        {auraModalOffersActivated}
                      </div>
                      )}
                    </div>
                    <div><div className="offer-instruction">{auraSelectOffers}</div></div>

                    {/* Tab Content */}
                    {activeTab === 'offers' && qrOffers?.coupons?.map((offer) => (
                      <div className="offer-content" id="offers" key={offer.id}>
                        <div className="offer-item">
                          <div className="offer-item-title">
                            <div className="offer-title">{offer.category_name}</div>
                            <button
                              className="aura-offer-apply-button"
                              onClick={() => handleApplyOffer(offer?.code, offer.id)}
                            >
                              {auraApply}
                            </button>
                          </div>
                          {/* <div className="status-message">{offer.status}</div> */}

                          {offerErrorMessage && <div className="status-message">{offerErrorMessage[offer.id]}</div>}
                          <div className="offer-description">
                            {offer.description}
                          </div>
                          <div className="offer-expiry">
                            {auraExpiry}
                            {offer?.expiry_date}
                          </div>

                        </div>
                      </div>
                    ))}

                    {activeTab === 'activateOffers' && activatedOffers?.accepted_offer?.map((activated) => (
                      <div className="offer-content" id="activate-offers">
                        <div className="offer-item activated">
                          <div className="offer-item-title">
                            <div className="offer-title">{activated.name}</div>
                            <button className="applied-button" disabled>{auraActivated}</button>
                          </div>
                          <div className="offer-description">
                            {activated.description}
                          </div>
                          <div className="offer-expiry">Expiry: 11 September 2024</div>
                          <div className="activated-message">
                            {auraOfferAutomaticText}
                          </div>
                        </div>

                      </div>
                    ))}

                  </div>

                </Dialog>
              </div>
              )}
            </>
          ) : (
            <>
              <div className="content">{auraInfoGuest}</div>
              {apcData?.apc_identifier_number && auraLinked === 1 && isLoggedIn && (
                <div className="link-account-chip">
                  <span className="link-account-chip-label">
                    {accountToLink}
                  </span>
                  <span className="link-account-chip-value">
                    {apcData.apc_identifier_number.match(/.{1,4}/g).join(' ')}
                  </span>
                </div>
              )}
              <div className="links-container">
                <span onClick={() => openJoinORLinkAuraModal('link')}>
                  {isLoggedIn ? auraLinkNow : auraSignIn}
                </span>
                {!apcData?.apc_identifier_number && (
                  <span onClick={() => openJoinORLinkAuraModal('join')}>
                    {auraJoinNow}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AuraDetails;
