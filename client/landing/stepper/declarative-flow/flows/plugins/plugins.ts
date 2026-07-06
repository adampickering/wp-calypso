import { OnboardActions, OnboardSelect } from '@automattic/data-stores';
import { clearStepPersistedState, PLUGINS_FLOW } from '@automattic/onboarding';
import { MinimalRequestCartProduct } from '@automattic/shopping-cart';
import { useDispatch, useSelect } from '@wordpress/data';
import { addQueryArgs, getQueryArgs } from '@wordpress/url';
import { useEffect } from 'react';
import { SIGNUP_DOMAIN_ORIGIN } from 'calypso/lib/analytics/signup';
import { pathToUrl } from 'calypso/lib/url';
import {
	persistSignupDestination,
	setSignupCompleteFlowName,
	setSignupCompleteSlug,
	clearSignupCompleteSlug,
	clearSignupCompleteFlowName,
	clearSignupDestinationCookie,
	clearSignupCompleteSiteID,
} from 'calypso/signup/storageUtils';
import { useDispatch as useReduxDispatch } from 'calypso/state';
import { setSelectedSiteId } from 'calypso/state/ui/actions';
import { useFlowLocale } from '../../../hooks/use-flow-locale';
import { useQuery } from '../../../hooks/use-query';
import { ONBOARD_STORE } from '../../../stores';
import { stepsWithRequiredLogin } from '../../../utils/steps-with-required-login';
import { getOnboardingPostCheckoutDestination } from '../../helpers/get-onboarding-post-checkout-destination';
import { STEPS } from '../../internals/steps';
import { ProcessingResult } from '../../internals/steps-repository/processing-step/constants';
import { type FlowV2, type SubmitHandler } from '../../internals/types';
import type { DomainSuggestion } from '@automattic/api-core';

function initialize() {
	const steps = [
		STEPS.DOMAIN_SEARCH,
		STEPS.USE_MY_DOMAIN,
		STEPS.UNIFIED_PLANS,
		STEPS.SITE_CREATION_STEP,
		STEPS.PROCESSING,
	];

	return [ ...stepsWithRequiredLogin( steps ), STEPS.ERROR ];
}

/**
 * Signup flow for the logged-out Plugins marketplace "Get started" CTA:
 * account → domain → plans → checkout, with the free plan hidden.
 */
const plugins: FlowV2< typeof initialize > = {
	name: PLUGINS_FLOW,
	isSignupFlow: true,
	__experimentalUseBuiltinAuth: true,
	initialize,
	useStepNavigation( currentStepSlug, navigate ) {
		const flowName = this.name;

		const {
			setDomain,
			setDomainCartItem,
			setDomainCartItems,
			setPlanCartItem,
			setProductCartItems,
			setSiteUrl,
			setSignupDomainOrigin,
		} = useDispatch( ONBOARD_STORE ) as OnboardActions;
		const locale = useFlowLocale();
		const { signupDomainOrigin } = useSelect(
			( select ) => ( {
				signupDomainOrigin: ( select( ONBOARD_STORE ) as OnboardSelect ).getSignupDomainOrigin(),
			} ),
			[]
		);
		const coupon = useQuery().get( 'coupon' );

		const submit: SubmitHandler< typeof initialize > = async ( submittedStep ) => {
			const { slug, providedDependencies } = submittedStep;
			switch ( slug ) {
				case 'domains':
					if ( ! providedDependencies ) {
						throw new Error( 'No provided dependencies found' );
					}

					if ( providedDependencies.navigateToUseMyDomain ) {
						const useMyDomainURL = addQueryArgs( 'use-my-domain', {
							...getQueryArgs( window.location.href ),
							initialQuery: providedDependencies.lastQuery,
						} );

						return navigate( useMyDomainURL as typeof currentStepSlug );
					}

					setSiteUrl( providedDependencies.siteUrl as string );
					setDomain( providedDependencies.suggestion as DomainSuggestion );
					setDomainCartItem( providedDependencies.domainItem as MinimalRequestCartProduct );
					setDomainCartItems( providedDependencies.domainCart as MinimalRequestCartProduct[] );
					setSignupDomainOrigin( providedDependencies.signupDomainOrigin as string );

					return navigate( 'plans' );
				case 'use-my-domain': {
					if (
						providedDependencies &&
						'mode' in providedDependencies &&
						providedDependencies.mode &&
						providedDependencies.domain
					) {
						const destination = addQueryArgs( '/use-my-domain', {
							...getQueryArgs( window.location.href ),
							step: providedDependencies.mode,
							initialQuery: providedDependencies.domain,
						} );
						return navigate( destination as typeof currentStepSlug );
					}

					if ( providedDependencies && 'domainCartItem' in providedDependencies ) {
						setSignupDomainOrigin( SIGNUP_DOMAIN_ORIGIN.USE_YOUR_DOMAIN );
						setDomainCartItem( providedDependencies.domainCartItem as MinimalRequestCartProduct );
					}

					return navigate( 'plans' );
				}
				case 'plans': {
					const cartItems = providedDependencies.cartItems;
					const [ pickedPlan, ...products ] = cartItems ?? [];

					setPlanCartItem( pickedPlan );

					if ( ! pickedPlan && signupDomainOrigin !== 'choose-later' ) {
						// No plan picked: record a free-domain origin, unless the domain choice was deferred.
						setSignupDomainOrigin( SIGNUP_DOMAIN_ORIGIN.FREE );
					}

					// Keep the plan's add-on products (e.g. storage) in the cart.
					setProductCartItems( products.filter( ( product ) => product !== null ) );

					setSignupCompleteFlowName( flowName );
					return navigate( 'create-site', undefined, false );
				}
				case 'create-site':
					return navigate( 'processing', undefined, true );
				case 'processing': {
					if ( providedDependencies.processingResult !== ProcessingResult.SUCCESS ) {
						return navigate( 'error' as typeof currentStepSlug );
					}

					const siteSlug = providedDependencies.siteSlug as string;
					const [ destination, backDestination, backDestinationDomains ] =
						getOnboardingPostCheckoutDestination( { flowName, locale, siteSlug } );

					persistSignupDestination( destination );
					setSignupCompleteFlowName( flowName );
					setSignupCompleteSlug( siteSlug );

					if ( providedDependencies.goToCheckout ) {
						// replace() so the processing step drops out of history.
						window.location.replace(
							addQueryArgs( `/checkout/${ encodeURIComponent( siteSlug ) }`, {
								redirect_to: destination,
								signup: 1,
								flow: flowName,
								checkoutBackUrl: pathToUrl( backDestination ?? '' ),
								...( backDestinationDomains
									? { checkoutBackUrlDomains: pathToUrl( backDestinationDomains ) }
									: {} ),
								coupon,
							} )
						);
					} else {
						window.location.replace( destination );
					}
					return;
				}
				default:
					return;
			}
		};

		const goBack = () => {
			switch ( currentStepSlug ) {
				case 'plans':
					return navigate( 'domains' );
				default:
					return window.history.back();
			}
		};

		return { submit, goBack };
	},
	useSideEffect( currentStepSlug ) {
		const reduxDispatch = useReduxDispatch();
		const { resetOnboardStore, setHideFreePlan } = useDispatch( ONBOARD_STORE ) as OnboardActions;

		// Reset persisted flow state on entry so the user starts clean.
		useEffect( () => {
			if ( ! currentStepSlug ) {
				resetOnboardStore();
				reduxDispatch( setSelectedSiteId( null ) );
				clearStepPersistedState( this.name );
				clearSignupDestinationCookie();
				clearSignupCompleteFlowName();
				clearSignupCompleteSlug();
				clearSignupCompleteSiteID();
			}
		}, [ currentStepSlug, reduxDispatch, resetOnboardStore ] );

		// Show all paid plans with the free plan hidden: plugins are available on any paid
		// plan, so we use the default plans grid rather than a plan-restricted intent. Runs
		// after the reset above and on direct entry to the plans step, so it always applies.
		useEffect( () => {
			setHideFreePlan( true );
		}, [ setHideFreePlan ] );
	},
};

export default plugins;
