import React from "react";
import './input.css';
import Icon from "../../icon/icon";

function Input({ label, value, containerClassName, inputClassName, errorMessage, icon, onIconClick, ...otherInputProps }) {
    return <div className={`form-input__container ${containerClassName ?? ''}`}>
        <input className={`form-input ${inputClassName ?? ''}`} value={value} {...otherInputProps} />
        {icon && <Icon name={icon} className='form-input__icon-container' onIconClick={onIconClick} />}
        {label ? <label className={`${value?.length ? 'active' : ''}`}>{label}</label> : null}
        {errorMessage ? <span className="error_message">{errorMessage}</span> : null}
    </div>
}

export default Input;