import React, { useState, useEffect, useContext, forwardRef, useImperativeHandle, useMemo } from 'react';
import CartContext from '../../../../context/cart-context.jsx';
import { decorateIcons } from '../../../../../scripts/aem.js';
import Icon from '../../../../library/icon/icon.jsx';
import transact from '../../../../api/transact.js';
import useCurrencyFormatter from '../../../../utils/hooks/useCurrencyFormatter.jsx';
import Loader from '../../../../shared/loader/loader.jsx';
import RedeemEgiftCardModal from './redeem-egift-modal.jsx';
import './redeem-egift-card.css';
import AppConstants from '../../../../utils/app.constants.js';
import ApiConstants from '../../../../api/api.constants.js';
import removeRedeemCardRedemption from '../../../../api/removeRedeemCardRedemption';
import updateRedeemEgiftAmount from '../../../../api/updateRedeemEgiftAmount.js';
import getSubCartGraphql from '../../../../api/getSubCartGraphql.js';
import Input from '../../../../library/Form/Input/input.jsx';
import { getTopupEgiftCardId, validateForMaxDecimalDigits } from '../../../../utils/base-utils.js';
import { PAYMENT_METHODS_NOT_FOR_EGIFTS } from '../../../cart/constants.js';

const RedeemEgiftCard = forwardRef(({ redeemegifthead, redeemegifttitle, redeemegiftsubtitle, finalisePayment }, ref) => {
    const { placeholders, cart, cartId, priceDecimals, isLoggedIn, setCart, setFullPaymentByEgift, isTopupFlag, fullPaymentUsingAura,configs , isDisablePayment} = useContext(CartContext);

    const isDisableRedeemGift = PAYMENT_METHODS_NOT_FOR_EGIFTS.includes(cart?.data?.selected_payment_method.code) || false;

    const egiftRedeemedAmount = cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_redeemed_amount;
    const egiftCurrentBalance = cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_current_balance;

    const balancePayment = cart?.data?.extension_attributes?.totals?.total_segments?.find((item) => item?.code === AppConstants.BALANCE_PAYMENT_METHOD_CODE);
    const auraPayment = cart?.data?.extension_attributes?.totals?.total_segments?.find((item) => item?.code === AppConstants.REDEEM_PAYMENT_METHOD_CODE);
    const baseGrandTotal = cart?.data?.extension_attributes?.totals?.base_grand_total ?? 0;

    const [isAccordionOpen, setIsAccordionOpen] = useState(false);
    const [isOtpFormVisible, setIsOtpFormVisible] = useState(false);
    const [isCardSectionVisible, setIsCardSectionVisible] = useState(true);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const [otp, setOtp] = useState('');
    const [showGetCode, setShowGetCode] = useState(true);
    const [cardNumber, setCardNumber] = useState('');
    const [email, setEmail] = useState('');
    const [errorMessageEmptyNumber, setErrorMessageEmptyNumber] = useState();
    const [emptyOtp, setEmptyOtp] = useState(false);
    const [currencyCode, setCurrencyCode] = useState('')
    const [showErrorMessageCard, setShowErrorMessageCard] = useState('');
    const [showErrorMessageOtp, setShowErrorMessageOtp] = useState(false);
    const [showErrorMessageGiftCardSelfTopup, setShowErrorMessageGiftCardSelfTopup] = useState(false);
    const [isRedeemConfirmation, setIsRedeemConfirmation] = useState(false);
    const [cardOriginalValue, setCardOriginalValue] = useState(egiftRedeemedAmount);
    const [cardBalanceAmount, setCardBalanceAmount] = useState();
    const [isLoading, setIsLoading] = useState(false);
    const [inputRedeemAmountError, setInputRedeemAmountError] = useState(false);
    const [isDisableSection, setIsDisableSection] = useState(false);

    const appliedCardValue = useCurrencyFormatter({ price: egiftRedeemedAmount, priceDecimals, currency: currencyCode });
    const totalCardBalance = useCurrencyFormatter({ price: egiftCurrentBalance, priceDecimals, currency: currencyCode });
    const [inputAmountRedeeme, setInputAmountRedeeme] = useState(appliedCardValue);
    const redeemedEgiftCardTwo = configs?.['checkout-redeem-egift-card-v2'] === 'true';
    const checkDisableRedeemEgiftFlag = configs?.['disable-redeem-egift-card-no-address'] === 'true';
    const DisableEgiftIfEgiftInCartFlag = configs?.['disable-redeem-egift-card-if-egift'] === 'true';
    const disableRedeemEgiftCard = checkDisableRedeemEgiftFlag === isDisablePayment;
    const cart_Id = cart?.data?.extension_attributes?.cart?.id;
    const grandTotal = cart?.data?.extension_attributes?.totals?.base_grand_total ?? 0;
    const topupGrandTotalValue = cart?.data?.extension_attributes?.totals?.base_grand_total ?? 0;
    const formattedPaybleAmount = useCurrencyFormatter({ price: balancePayment?.value })

    const amountToPayAboveRedeem = placeholders?.amountToPayAfterRedeem?.replace('{{BALANCEPAY}}', formattedPaybleAmount);

    const topupCarNumber = cart?.data?.extension_attributes?.cart?.items?.filter((item) => Number(item?.extension_attributes?.is_topup) === 1)[0]?.extension_attributes?.topup_card_number;

    const redeemPayload = {
        redeem_points: {
            action: 'send_otp',
            quote_id: cart_Id,
            card_number: cardNumber,
        }
    };

    const handleRedeemHeader = () => {
        setIsAccordionOpen(!isAccordionOpen);
    };

    //datalayer
    const dispatchDatalayerEvent = (eventType, eventAction, eventLabel) => {
        window.dispatchEvent(new CustomEvent(
            'react:datalayerEvent',
            {
                detail: {
                    type: eventType,
                    payload: {
                        eventAction,
                        eventLabel
                    }
                }
            }
        ));
    };

    const resetErrorStates = () => {
        setShowErrorMessageCard('');
        setShowErrorMessageGiftCardSelfTopup(false);
        setErrorMessageEmptyNumber(false);
        setEmptyOtp(false);
        setShowErrorMessageOtp(false);
    }

    const handleGetCode = async (e) => {
        e.preventDefault();
        // Dispatch datalayer for getotp
        dispatchDatalayerEvent(
            'eGiftCard',
            isLoggedIn ? 'egift_card_loggedin' : 'egift_card_guest',
            'egift_interaction'
        );
        if (isDisableSection) {
            return;
        }
        resetErrorStates();
        if (!cardNumber) {
            console.error('Error sending OTP, enter card');
            setShowErrorMessageCard('');
            setErrorMessageEmptyNumber(true);
            return;
        }

        if (isTopupFlag && cardNumber === topupCarNumber) {
            setShowErrorMessageGiftCardSelfTopup(true);
            return;
        }

        setIsLoading(true);
        try {
            const response = await transact(redeemPayload);
            if (response?.response_type) {
                setIsOtpFormVisible(true);
                setShowGetCode(false);
                setShowErrorMessageCard('');
                setErrorMessageEmptyNumber(false);
                setEmptyOtp(false);
                setOtp('');
                setEmail(response?.email);

            } else {
                console.error('Error sending OTP, incorrect card number');
                setShowErrorMessageCard(response?.response_message);
                setErrorMessageEmptyNumber(false);
            }
        } catch (error) {
            console.error('Error sending OTP:', error);
            setShowGetCode(true);
            setShowErrorMessageCard(placeholders.redeeEgiftInvalidCard);
            setErrorMessageEmptyNumber(false);
        }
        finally {
            setIsLoading(false);
        }
    };

    const verifyPayload = {
        redeem_points: {
            action: 'set_points',
            quote_id: cart_Id,
            amount: !isTopupFlag ? grandTotal : topupGrandTotalValue,
            card_number: cardNumber,
            payment_method: 'hps_payment',
            card_type: 'guest',
            otp,
            email
        }
    };

    const handleOTP = async (e) => {
        e.preventDefault();
        resetErrorStates();
        if (!otp) {
            console.error('Error verifying OTP, Enter OTP');
            setIsOtpVerified(false);
            setIsOtpFormVisible(true);
            setIsCardSectionVisible(true);
            setShowErrorMessageOtp(false);
            setEmptyOtp(true);
        }
        setIsLoading(true);
        try {
            const response = await transact(verifyPayload);
            let checkOTPverify = false;
            if (response.response_type) {
                setIsOtpVerified(true);
                setIsOtpFormVisible(false);
                setIsCardSectionVisible(false);
                checkOTPverify = true;
                setCart((prevCart) => ({
                    ...prevCart,
                    data: {
                        ...prevCart.data,
                        extension_attributes: {
                            ...prevCart.data.extension_attributes,
                            totals: response.totals
                        }
                    }
                }));

                setFullPaymentByEgift(response.totals.extension_attributes.hps_redeemed_amount === response.totals.base_grand_total);

            } else {
                console.error('Error verifying OTP');
                setEmptyOtp(false);
                setIsOtpVerified(false);
                setIsOtpFormVisible(true);
                setIsCardSectionVisible(true);
                setShowErrorMessageOtp(response.response_message);
            }
            setCurrencyCode(response?.totals?.base_currency_code ?? '')
            dispatchDatalayerEvent(
                'eGiftCard',
                isLoggedIn ? 'egift_card_loggedin' : 'egift_card_guest',
                checkOTPverify ? 'egift_verification_success' : 'egift_verification_fail'
            );
        } catch (error) {
            setShowErrorMessageOtp(placeholders.redeemOtpErrorText);
            console.error('Error verifying OTP:', error);
        }

        finally {
            setIsLoading(false);
        }
    };

    const handleEgiftRemove = async (e) => {
        e.preventDefault();
        resetErrorStates();
        dispatchDatalayerEvent(
            'eGiftCard',
            isLoggedIn ? 'egift_card_loggedin' : 'egift_card_guest',
            'egift_remove'
        );
        try {

            const payload = isLoggedIn ? {
                redemptionRequest: {
                    quote_id: cart?.data?.extension_attributes?.cart?.id,
                }
            } : {
                redemptionRequest: {
                    mask_quote_id: getTopupEgiftCardId() ?? cart?.data?.id,
                }
            };
            setIsLoading(true);
            const response = await removeRedeemCardRedemption(payload, isLoggedIn);
            if (response.response_type) {

                const availableRedeemData = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__EXTENSION_ATTRIBUTE]);

                setCart((prevCart) => ({
                    ...prevCart,
                    data: {
                        ...prevCart.data,
                        extension_attributes: {
                            ...prevCart.data.extension_attributes,
                            totals: availableRedeemData.extension_attributes.totals
                        }
                    }
                }));

                setFullPaymentByEgift(false);

                setCardNumber('');
                setEmptyOtp(false);
                setIsOtpFormVisible(false);
                setIsCardSectionVisible(true);
                setShowGetCode(true);
                setIsOtpVerified(false);
                setShowErrorMessageOtp(false);
            }
        } catch (error) {
            console.error('Error removing egift card:', error);
        }
        finally {
            setIsLoading(false);
        }
    }

    const handleRedeemEdit = () => {
        setIsRedeemConfirmation(true);
    };

    const handleCloseModal = () => {
        setIsRedeemConfirmation(false);
    };

    const handleChangeCard = () => {

        setIsOtpFormVisible(false);
        setShowGetCode(true);
        setShowErrorMessageCard('');
        setErrorMessageEmptyNumber(false);
        setEmptyOtp(false);
        setOtp('');

    }

    const handleEditApplyAmount = async () => {


        let cartTotal = baseGrandTotal;
        // The cart total for egift should be less than the redemption amount and
        // the pending balance.
        if (balancePayment?.value >= 0
            && egiftRedeemedAmount >= 0
            && (balancePayment.value + egiftRedeemedAmount) < cartTotal) {
            cartTotal = balancePayment.value + egiftRedeemedAmount;
        }

        // Handling validation for the changing the amount of egift card.
        let errorMessage = '';
        // Proceed only if user has entered some value.
        if (inputAmountRedeeme.length === 0) {
            errorMessage = placeholders?.formEgiftAmount ?? '';
        } else if (egiftCurrentBalance && (inputAmountRedeeme > (egiftRedeemedAmount + egiftCurrentBalance))) {
            errorMessage = placeholders?.egiftInsufficientBalance ?? '';
        } else if (inputAmountRedeeme <= 0) {
            errorMessage = placeholders?.egiftValidAmount ?? '';
        } else if (inputAmountRedeeme > cartTotal) {
            errorMessage = placeholders?.redeemEgiftError ?? '';
        } else if (auraPayment && ((parseFloat(inputAmountRedeeme) + auraPayment?.value) < baseGrandTotal)) {
            errorMessage = placeholders?.redeemEgiftFullError ?? '';
        } else if (validateForMaxDecimalDigits(inputAmountRedeeme, priceDecimals ?? 2)) {
            errorMessage = placeholders.redeemGiftcardMaxDecimalPointsErrorMessage?.replace('{{DECIMAL_DIGITS}}', priceDecimals ?? 2);
        }
        setInputRedeemAmountError(errorMessage);
        if (errorMessage) {
            return;
        }
        try {
            const newAmount = parseFloat(inputAmountRedeeme);
            const payload = isLoggedIn ? {
                redemptionRequest: {
                    amount: newAmount,
                }
            } : {
                redemptionRequest: {
                    amount: newAmount,
                    mask_quote_id: getTopupEgiftCardId() ?? cartId,
                }
            };

            setIsLoading(true);
            const response = await updateRedeemEgiftAmount(payload, isLoggedIn);
            if (response.response_type) {
                setCart((prevCart) => ({
                    ...prevCart,
                    data: {
                        ...prevCart.data,
                        extension_attributes: {
                            ...prevCart.data.extension_attributes,
                            totals: response.totals
                        }
                    }
                }));

                setFullPaymentByEgift(response.totals.extension_attributes.hps_redeemed_amount === response.totals.base_grand_total);
                setIsRedeemConfirmation(false);
            }
        } catch (error) {
            console.error('Error redeem egift amount:', error);
        }
        finally {
            setIsLoading(false);
        }

    }

    useEffect(() => {
        const section = document.querySelector("#redeem_egift_card_section");
        if (section) {
            decorateIcons(section);
        }
    }, []);

    useEffect(() => {
        const hps_redemption_type = cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_redemption_type;
        if (hps_redemption_type === AppConstants.PAYMENT_EGIFT_CARD_linked || isDisableRedeemGift || fullPaymentUsingAura) {
            setIsDisableSection(true);
        }
        else {
            if (egiftRedeemedAmount > 0) {
                setIsOtpVerified(true);
                setIsOtpFormVisible(false);
                setIsCardSectionVisible(false);
                setIsAccordionOpen(true)
            }
            setIsDisableSection(false);
        }

        const totals = cart?.data?.extension_attributes?.totals;
        const redeemed_amount = totals?.extension_attributes?.hps_redeemed_amount;
        const isRedeemedEqualsTotal = redeemed_amount > 0 && redeemed_amount === totals.base_grand_total;
        const isPaymentValid = auraPayment
        ? auraPayment?.value + redeemed_amount === totals?.base_grand_total
        : isRedeemedEqualsTotal;
        setFullPaymentByEgift(isPaymentValid);

    }, [cart, fullPaymentUsingAura]);

    useEffect(() => {
        setInputAmountRedeeme(egiftRedeemedAmount);
    }, [cart]);

    useImperativeHandle(ref, () => ({
        completePurchase: async () => {
            const payload = {
                payment: {
                    method: AppConstants.hps_payment_method,
                },
            };
            await finalisePayment(payload);
        },
    }));

    const cardNumberErrorMessage = useMemo(() => {
        let errorMessage = '';

        if (errorMessageEmptyNumber){
            errorMessage = placeholders.redeemEmptyCardNumberError;
            window.dispatchEvent(new CustomEvent('react:datalayerEvent', {
                detail: {
                    type: 'checkoutErrors',
                    payload: {
                        action: placeholders.redeemEmptyCardNumberError,
                        label: placeholders.redeemEmptyCardNumberError
                    }
                },
            }));
        } 
        else if (showErrorMessageGiftCardSelfTopup) {
            errorMessage = placeholders.giftCardTopupSelfErrorMessage;
            window.dispatchEvent(new CustomEvent('react:datalayerEvent', {
                detail: {
                    type: 'checkoutErrors',
                    payload: {
                        action: placeholders.giftCardTopupSelfErrorMessage,
                        label: placeholders.giftCardTopupSelfErrorMessage
                    }
                },
            }));
        }
        else if (showErrorMessageCard) {
            errorMessage = showErrorMessageCard; // placeholders.redeeEgiftInvalidCard;
            //occures when card  number is not valid
            window.dispatchEvent(new CustomEvent('react:datalayerEvent', {
                detail: {
                    type: 'checkoutErrors',
                    payload: {
                        action: placeholders.redeeEgiftInvalidCard,
                        label: 'The card number entered is invalid. Please check you have entered the number correctly or try a different card'
                    }
                },
            }));
        }

        return errorMessage;
    }, [errorMessageEmptyNumber, showErrorMessageGiftCardSelfTopup, showErrorMessageCard, placeholders]);

    const cardNumberOTPErrorMessage = useMemo(() => {
        let errorMessage = '';

        if (emptyOtp) {
            errorMessage = placeholders.redeemeOtpEmptyError;
            window.dispatchEvent(new CustomEvent(
                'react:datalayerEvent',
                {
                  detail: {
                    type: 'checkoutErrors',
                    payload: {
                      action: placeholders.redeemeOtpEmptyError,
                      label: placeholders.redeemeOtpEmptyError
                    }
                  },
                },
              ));
        }
        else if (showErrorMessageOtp){
            errorMessage = showErrorMessageOtp;
            window.dispatchEvent(new CustomEvent(
                'react:datalayerEvent',
                {
                  detail: {
                    type: 'checkoutErrors',
                    payload: {
                      action: showErrorMessageOtp,
                      label: showErrorMessageOtp
                    }
                  },
                },
              ));
        } 

        return errorMessage;
    }, [emptyOtp, showErrorMessageOtp, placeholders]);

    const giftCardNumberChange = (num) => {
        num = num.replace(/[^\p{N}]/gu, '');
        num = num.substr(0, 16);
        setCardNumber(num);
    }

    useEffect(() => {
        const items = cart?.data?.items || [];
        items.forEach((item) => {
            const isEgift = item?.extensionAttributes?.extension_attributes?.is_egift == 1;
            if (isEgift && DisableEgiftIfEgiftInCartFlag) {
                setIsDisableSection(true);
            }
        });
    }, [cart]);

    return (
        <div className={`redeem_container ${isDisableSection || disableRedeemEgiftCard ? 'in-active' : ''} ${redeemedEgiftCardTwo ? 'redeemed-egift-card-two' : ''}`}>
            {isLoading && (
                <div className="loader_overlay">
                    <Loader />
                </div>
            )}
            <div className='redeem_egift_card' id='redeem_egift_card_section'>
                <div className='redeem_egift_card_header_container' onClick={handleRedeemHeader}>
                    <span className="icon icon-egift-redeem"></span>
                    <div className='redeem_egift_card_label'>{redeemegifthead}</div>
                    <span className='accordion_icon'>
                        <span className="icon icon-chevron-down"></span>
                    </span>
                </div>

                {!disableRedeemEgiftCard && !isDisableSection && isAccordionOpen && (
                    <div className='redeem_egift_card_content'>
                        {!isOtpVerified && <div className='egift_header_wrapper'>
                            <div className='egift_header_title'>{redeemegifttitle}</div>
                            {!isOtpFormVisible && <div className='egift_header_subtitle'>{redeemegiftsubtitle}</div>}
                        </div>}

                        <div className='egift_form_wrapper'>
                            {isCardSectionVisible && !isOtpVerified && (
                                <form className='egift_redeem_get_code_form' onSubmit={handleGetCode}>
                                    <Input
                                        containerClassName='redeem-egift__input'
                                        id="egift_card_number"
                                        type="number"
                                        value={cardNumber}
                                        onChange={(e) => giftCardNumberChange(e.target.value)}
                                        disabled={isOtpFormVisible}
                                        label={placeholders.egiftCardInputTitle}
                                        errorMessage={cardNumberErrorMessage}
                                    />
                                    <div className='egift_getcode_submit_button'>
                                        {showGetCode && (<input
                                            className='code_submit'
                                            id='egift_button'
                                            type='submit'
                                            value={placeholders.egiftGetcode}
                                        />)}
                                    </div>
                                </form>
                            )}

                            {isOtpFormVisible && !isOtpVerified && (
                                <form className='egift_otp_form' onSubmit={handleOTP}>
                                    <div className='egift_otp_form_input'>
                                        <Input
                                            containerClassName='redeem-egift__input'
                                            id="egift_otp"
                                            type="text"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            label={placeholders.egiftCardInputPlaceholder}
                                            disabled={isDisableSection}
                                            errorMessage={cardNumberOTPErrorMessage}
                                        />

                                        {<div className='verify_otp'>
                                            <div>{placeholders.egictCardNoOtpText} <a onClick={handleGetCode}>{placeholders.egiftCardResendOtp}</a></div>
                                            <div><a onClick={handleChangeCard}>{placeholders.egiftCardChangeCard}</a></div>
                                        </div>}
                                    </div>
                                    <div className='egift_otp_verify_button'>
                                        <input
                                            className='otp_submit'
                                            id='otp_button'
                                            type='submit'
                                            value={placeholders.egiftCardVerify}
                                        />
                                    </div>
                                </form>
                            )}

                            {isOtpVerified && (
                                <div className='egift_card_overview'>
                                    <div className='egift_otp_input_3rd'>
                                        <div className='egift_header_title'>{placeholders.egiftCardAmountText} {appliedCardValue}</div>
                                        <div className='egift_header_subtitle'>{placeholders.egiftCardBalanceText} {totalCardBalance}</div>
                                        <div className='edit_link_text' onClick={handleRedeemEdit}>
                                            {placeholders.redeemGiftcardEditText}
                                        </div>

                                        {balancePayment?.value > 0 && (
                                            <div className='egift_payment_difference'>
                                                <Icon className='icon_blue' name="info-blue" /> {amountToPayAboveRedeem}
                                            </div>
                                        )}
                                    </div>
                                    <div className='egift_remove_button'>
                                        <input
                                            className='egift_remove'
                                            id='remove_button'
                                            type='submit'
                                            value={placeholders.egiftCardRemove}
                                            onClick={handleEgiftRemove}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isRedeemConfirmation && (
                    <RedeemEgiftCardModal
                        placeholders={placeholders}
                        handleCloseModal={handleCloseModal}
                        appliedCardValue={appliedCardValue}
                        totalCardBalance={totalCardBalance}
                        inputAmountRedeeme={inputAmountRedeeme}
                        setInputAmountRedeeme={setInputAmountRedeeme}
                        handleEditApplyAmount={handleEditApplyAmount}
                        inputRedeemAmountError={inputRedeemAmountError}
                        showModal={isRedeemConfirmation}
                    />
                )}
            </div>
        </div>
    );
});

export default RedeemEgiftCard;
