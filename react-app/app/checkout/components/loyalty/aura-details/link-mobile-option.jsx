import React, { useState, useEffect } from 'react';
import { getCountryIso, getMaxLengthByCountryCode } from '../../../../../../scripts/helpers/country-list.js';
import { getConfigValue } from '../../../../../../scripts/configs.js';

function LinkMobileOption({
  loyaltyMobilePlaceholder,
  value,
}) {
  const [countryPrefix, setCountryPrefix] = useState('');
  const [mobileMaxLength, setMobileMaxLength] = useState('');

  useEffect(() => {
    const fetchCountryPrefixAndMaxLength = async () => {
      const countryCode = await getConfigValue('country-code');
      const prefix = `+${await getCountryIso(countryCode)}`;
      const maxLength = await getMaxLengthByCountryCode(countryCode);
      setCountryPrefix(prefix);
      setMobileMaxLength(maxLength);
    };

    fetchCountryPrefixAndMaxLength();
  }, []);

  return (
    <>
      <label htmlFor="spc-aura-link-card-input-mobile-mobile-number" className="countrycode">{countryPrefix}</label>
      <input
        type="tel"
        id="spc-aura-link-card-input-mobile-mobile-number"
        name="spc-aura-link-card-input-mobile-mobile-number"
        data-phone-prefix={countryPrefix}
        aria-label="mobile number"
        placeholder={loyaltyMobilePlaceholder}
        value={value}
        required
        pattern="[0-9]*"
        maxLength={mobileMaxLength}
      />
    </>
  );
}

export default LinkMobileOption;
