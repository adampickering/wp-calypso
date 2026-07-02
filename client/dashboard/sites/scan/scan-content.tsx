import { isEnabled } from '@automattic/calypso-config';
import { Button, Modal, TabPanel } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useState } from 'react';
import { useAnalytics } from '../../app/analytics';
import { PerformanceTrackerStop } from '../../app/performance-tracking';
import { ButtonStack } from '../../components/button-stack';
import { Card, CardHeader, CardBody } from '../../components/card';
import { PageHeader } from '../../components/page-header';
import PageLayout from '../../components/page-layout';
import { useTimeSince } from '../../components/time-since';
import { ActiveThreatsDataViews } from '../scan-active';
import { ScanHistoryDataViews } from '../scan-history';
import { BulkFixThreatsModal } from './components/bulk-fix-threats-modal';
import { ScanNotices } from './scan-notices';
import { ScanNowButton } from './scan-now-button';
import { ScanStatus } from './status';
import { useScanState } from './use-scan-state';
import type { Site } from '@automattic/api-core';

const SCAN_TABS = [
	{ name: 'active', title: __( 'Active threats' ) },
	{ name: 'history', title: __( 'History' ) },
];

export function ScanContent( {
	site,
	scanTab,
	onTabChange,
	timezoneString,
	gmtOffset,
	notices,
}: {
	site: Site;
	scanTab: 'active' | 'history';
	onTabChange: ( tab: 'active' | 'history' ) => void;
	timezoneString?: string;
	gmtOffset?: number;
	notices?: React.ReactNode;
} ) {
	const { recordTracksEvent } = useAnalytics();
	const [ showBulkFixModal, setShowBulkFixModal ] = useState( false );

	const scanState = useScanState( site.ID );
	const { scan, status } = scanState;
	const isScanInProgress = status === 'enqueued' || status === 'running';
	const fixableThreatsCount = scan?.threats?.filter( ( threat ) => threat.fixable ).length || 0;
	const lastScanTime = scan?.most_recent?.timestamp;
	const lastScanRelativeTime = useTimeSince( lastScanTime || '' );
	const threatCount = scan?.threats?.length || 0;

	const showScanNotices = status === 'error' || status === 'success';

	const getPageDescription = () => {
		if ( lastScanTime && lastScanRelativeTime ) {
			return sprintf(
				/* translators: %s: relative time since last scan */
				__( 'Latest scan ran %s.' ),
				lastScanRelativeTime
			);
		}

		return null;
	};

	const renderActiveTab = () => {
		if ( isScanInProgress ) {
			return (
				<>
					<PerformanceTrackerStop />
					<ScanStatus scanState={ scanState } />
				</>
			);
		}
		return (
			<ActiveThreatsDataViews
				site={ site }
				timezoneString={ timezoneString }
				gmtOffset={ gmtOffset }
			/>
		);
	};

	return (
		<>
			<PageLayout
				header={
					<PageHeader
						description={ getPageDescription() }
						actions={
							<ButtonStack>
								<ScanNowButton site={ site } scanState={ scanState } />
								{ fixableThreatsCount > 0 && (
									<Button
										variant="primary"
										disabled={ isScanInProgress }
										onClick={ () => {
											recordTracksEvent( 'calypso_dashboard_scan_fix_threats_cta_click', {
												threat_count: fixableThreatsCount,
											} );
											setShowBulkFixModal( true );
										} }
									>
										{ sprintf(
											/* translators: %(threatsCount)d: number of threats */
											_n(
												'Auto-fix %(threatsCount)d threat',
												'Auto-fix %(threatsCount)d threats',
												fixableThreatsCount
											),
											{
												threatsCount: fixableThreatsCount,
											}
										) }
									</Button>
								) }
							</ButtonStack>
						}
					/>
				}
				notices={
					<>
						{ /* Action feedback, not an on-load banner: rendered outside the arbiter. */ }
						{ showScanNotices && <ScanNotices status={ status } threatCount={ threatCount } /> }
						{ notices }
					</>
				}
			>
				<Card>
					{ ! isEnabled( 'dashboard/omnibar' ) && (
						<CardHeader style={ { paddingBottom: '0' } }>
							<TabPanel
								activeClass="is-active"
								tabs={ SCAN_TABS }
								onSelect={ ( tabName ) => {
									if ( tabName === 'active' || tabName === 'history' ) {
										onTabChange( tabName );
									}
								} }
								initialTabName={ scanTab }
							>
								{ () => null }
							</TabPanel>
						</CardHeader>
					) }
					<CardBody>
						{ scanTab === 'active' && renderActiveTab() }
						{ scanTab === 'history' && (
							<ScanHistoryDataViews
								site={ site }
								timezoneString={ timezoneString }
								gmtOffset={ gmtOffset }
							/>
						) }
					</CardBody>
				</Card>
			</PageLayout>
			{ showBulkFixModal && (
				<Modal
					title={ __( 'Auto-fix threats' ) }
					onRequestClose={ () => setShowBulkFixModal( false ) }
					size="medium"
				>
					<BulkFixThreatsModal
						items={ scan?.threats?.filter( ( threat ) => threat.fixable ) || [] }
						closeModal={ () => setShowBulkFixModal( false ) }
						site={ site }
					/>
				</Modal>
			) }
		</>
	);
}
