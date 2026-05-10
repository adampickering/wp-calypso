/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import {
	EMAIL_WARNING_CODE_DOMAIN_STATE_RESTRICTED,
	EMAIL_WARNING_CODE_GRAVATAR_DOMAIN,
	EMAIL_WARNING_CODE_OTHER_USER_OWNS_DOMAIN_SUBSCRIPTION,
} from 'calypso/lib/emails/email-provider-constants';
import { useSelector } from 'calypso/state';
import EmailForwardingLink from '..';
import type { ResponseDomain } from 'calypso/lib/domains/types';
import type { ReactElement } from 'react';

jest.mock( 'i18n-calypso', () => {
	const React = require( 'react' );

	const translate = ( text: string, options?: { components?: { a?: ReactElement } } ) => {
		if ( options?.components?.a ) {
			const [ beforeLink, rest = '' ] = text.split( '{{a}}' );
			const [ linkText, afterLink = '' ] = rest.split( '{{/a}}' );

			return (
				<>
					{ beforeLink }
					{ React.cloneElement( options.components.a, {}, linkText ) }
					{ afterLink }
				</>
			);
		}

		return text;
	};

	return {
		localize: ( component: unknown ) => component,
		translate,
		useTranslate: () => translate,
	};
} );

jest.mock( 'calypso/lib/domains', () => ( {
	getCurrentUserCannotAddEmailReason: jest.fn( ( domain ) =>
		domain && ! domain.currentUserCanAddEmail ? domain.currentUserCannotAddEmailReason : null
	),
	getSelectedDomain: jest.fn(
		( { domains, selectedDomainName } ) =>
			domains?.find( ( domain: ResponseDomain ) => domain.name === selectedDomainName )
	),
} ) );

jest.mock( 'calypso/state', () => ( {
	useSelector: jest.fn(),
} ) );

jest.mock( 'calypso/state/selectors/get-current-route', () =>
	jest.fn( ( state ) => state.currentRoute )
);

jest.mock( 'calypso/state/sites/domains/selectors', () => ( {
	getDomainsBySiteId: jest.fn( ( state ) => state.domains ),
} ) );

jest.mock( 'calypso/state/ui/selectors', () => ( {
	getSelectedSite: jest.fn( ( state ) => state.selectedSite ),
} ) );

const selectedSite = {
	ID: 123,
	slug: 'example.wordpress.com',
};

const baseDomain = {
	name: 'example.com',
	domain: 'example.com',
	emailForwardsCount: 0,
	currentUserCanAddEmail: true,
	currentUserCannotAddEmailReason: null,
} as ResponseDomain;

const renderLink = ( domain: ResponseDomain | undefined = baseDomain ) => {
	const state = {
		currentRoute: '/email/example.com/purchase/example.wordpress.com',
		domains: domain ? [ domain ] : [],
		selectedSite,
	};

	( useSelector as jest.Mock ).mockImplementation( ( selector ) => selector( state ) );

	return render( <EmailForwardingLink selectedDomainName="example.com" /> );
};

describe( 'EmailForwardingLink', () => {
	afterEach( () => {
		jest.clearAllMocks();
	} );

	it( 'shows the email forwarding link for a domain owner without forwards', () => {
		renderLink();

		expect( screen.getByRole( 'link', { name: 'Email Forwarding' } ) ).toHaveAttribute(
			'href',
			'/email/example.com/forwarding/add/example.wordpress.com?source=purchase'
		);
	} );

	it( 'shows the email forwarding link for a non-owner who cannot purchase paid email', () => {
		renderLink( {
			...baseDomain,
			currentUserCanAddEmail: false,
			currentUserCannotAddEmailReason: {
				code: EMAIL_WARNING_CODE_OTHER_USER_OWNS_DOMAIN_SUBSCRIPTION,
				message: 'Only the domain owner can purchase email.',
			},
		} );

		expect( screen.getByRole( 'link', { name: 'Email Forwarding' } ) ).toBeVisible();
	} );

	it( 'hides the link when the domain already has forwards', () => {
		renderLink( {
			...baseDomain,
			emailForwardsCount: 1,
		} );

		expect( screen.queryByRole( 'link', { name: 'Email Forwarding' } ) ).not.toBeInTheDocument();
	} );

	it.each( [ EMAIL_WARNING_CODE_DOMAIN_STATE_RESTRICTED, EMAIL_WARNING_CODE_GRAVATAR_DOMAIN ] )(
		'hides the link when add-forwarding is blocked by %s',
		( code ) => {
			renderLink( {
				...baseDomain,
				currentUserCanAddEmail: false,
				currentUserCannotAddEmailReason: {
					code,
					message: 'Email forwarding is unavailable for this domain.',
				},
			} );

			expect( screen.queryByRole( 'link', { name: 'Email Forwarding' } ) ).not.toBeInTheDocument();
		}
	);
} );
