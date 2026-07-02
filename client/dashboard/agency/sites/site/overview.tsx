import { agencySiteRoute } from '../../../app/router/agency';
import { PageHeader } from '../../../components/page-header';
import PageLayout from '../../../components/page-layout';
import { getDisplayUrl, getSiteName } from '../dataviews/site-data';
import ScanCard from './scan-card';

export default function AgencySiteOverview() {
	const { siteSlug } = agencySiteRoute.useParams();
	const site = agencySiteRoute.useLoaderData();

	return (
		<PageLayout
			header={ <PageHeader title={ getSiteName( site ) } description={ getDisplayUrl( site ) } /> }
		>
			<ScanCard site={ site } siteSlug={ siteSlug } />
		</PageLayout>
	);
}
