import { resolveSmsCountry } from '../contact-validation-utils';
import type { SMSCountryCode } from '@automattic/api-core';

const SMS_COUNTRY_CODES: SMSCountryCode[] = [
	{ code: 'BS', country_name: 'Bahamas', name: 'Bahamas (+1)', numeric_code: '+1' },
	{ code: 'CA', country_name: 'Canada', name: 'Canada (+1)', numeric_code: '+1' },
	{ code: 'US', country_name: 'United States', name: 'United States (+1)', numeric_code: '+1' },
	{ code: 'DE', country_name: 'Germany', name: 'Germany (+49)', numeric_code: '+49' },
];

describe( 'resolveSmsCountry', () => {
	test( 'prefers the contact country when several countries share a dialing code', () => {
		// Regression test for DOMENG-635: a +1 US number used to resolve to the
		// first +1 entry (the Bahamas) instead of the contact's own country.
		expect( resolveSmsCountry( SMS_COUNTRY_CODES, '+1', 'US' )?.code ).toBe( 'US' );
		expect( resolveSmsCountry( SMS_COUNTRY_CODES, '+1', 'CA' )?.code ).toBe( 'CA' );
	} );

	test( 'falls back to the first match when the contact country does not share the code', () => {
		expect( resolveSmsCountry( SMS_COUNTRY_CODES, '+1', 'GB' )?.code ).toBe( 'BS' );
	} );

	test( 'resolves an unambiguous dialing code regardless of the contact country', () => {
		expect( resolveSmsCountry( SMS_COUNTRY_CODES, '+49', 'US' )?.code ).toBe( 'DE' );
	} );

	test( 'returns undefined when no country matches the dialing code', () => {
		expect( resolveSmsCountry( SMS_COUNTRY_CODES, '+99', 'US' ) ).toBeUndefined();
	} );

	test( 'returns undefined when the country list is unavailable', () => {
		expect( resolveSmsCountry( undefined, '+1', 'US' ) ).toBeUndefined();
	} );
} );
