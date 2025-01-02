import { getTamaraAvailability } from "../api/getTamaraAvailability";
import { hasValue } from "./base-utils";

let tamaraStatus = [];
const Tamara = {
    // Verify if the Tamara payment option is available for the current cart or
    // not. For this, we need call an MDC API to get the Tamara availability.
    // This function will return TRUE/FALSE based on the availability status.
    isAvailable: async (cart, setTamaraAvailable, isLoggedIn) => {
        // Get the cart total to store the tamara status in Static Storage. If we
        // found an status for the cart total in Static storage, we will return from
        // there else we will make an API call to Magento to get the satus.
        const value = cart?.data?.extension_attributes?.totals?.base_grand_total;
        const { surcharge } = cart?.data?.extension_attributes?.cart?.extension_attributes;
        let total = value;
        if (hasValue(value) && hasValue(surcharge)) {
            if (surcharge.is_applied)
                total = value - surcharge.amount;
        }
        // Check if the tamaraStatus for current cart value exist in the Static
        // Storage and return.
        if (tamaraStatus && typeof tamaraStatus[total] !== 'undefined') {
            setTamaraAvailable(tamaraStatus[total]);
            return;
        }

        // Get availability from MDC for the current cart.
        const response = await getTamaraAvailability(cart.data.id, isLoggedIn);

        // Set the default tamara availability status to false for cart value.
        tamaraStatus[total] = false;

        // If `is_available` is set to '1', it means tamara payment option is
        // available for the current cart value. It also means that current cart
        // value falls in Tamara threshold limit.
        // If the payment option available, update the tamaraStatus variable for the
        //  cart value.
        if (hasValue(response?.is_available)) {
            tamaraStatus[total] = true;
        }

        // Return the tamara status from the Static Storage for the cart value.
        setTamaraAvailable(tamaraStatus[total]);
    },
};

export default Tamara;
