import './GridCardLayout.styles.scss';

import { SOMETHING_WENT_WRONG } from 'constants/api';
import { QueryParams } from 'constants/query';
import { PANEL_TYPES } from 'constants/queryBuilder';
import { themeColors } from 'constants/theme';
import { useUpdateDashboard } from 'hooks/dashboard/useUpdateDashboard';
import useComponentPermission from 'hooks/useComponentPermission';
import { useIsDarkMode } from 'hooks/useDarkMode';
import { useNotifications } from 'hooks/useNotifications';
import useUrlQuery from 'hooks/useUrlQuery';
import history from 'lib/history';
import isEqual from 'lodash-es/isEqual';
import { useDashboard } from 'providers/Dashboard/Dashboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FullScreen, FullScreenHandle } from 'react-full-screen';
import { Layout } from 'react-grid-layout';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { UpdateTimeInterval } from 'store/actions';
import { AppState } from 'store/reducers';
import { Dashboard, Widgets } from 'types/api/dashboard/getAll';
import AppReducer from 'types/reducer/app';
import { ROLES, USER_ROLES } from 'types/roles';
import { ComponentTypes } from 'utils/permission';

import { EditMenuAction, ViewMenuAction } from './config';
import DashboardEmptyState from './DashboardEmptyState/DashboardEmptyState';
import GridCard from './GridCard';
import { Card, CardContainer, ReactGridLayout } from './styles';
import { removeUndefinedValuesFromLayout } from './utils';

interface GraphLayoutProps {
	handle: FullScreenHandle;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function GraphLayout(props: GraphLayoutProps): JSX.Element {
	const { handle } = props;
	const {
		selectedDashboard,
		layouts,
		setLayouts,
		setSelectedDashboard,
		isDashboardLocked,
	} = useDashboard();
	const { data } = selectedDashboard || {};
	const { pathname } = useLocation();
	const dispatch = useDispatch();

	const { widgets, variables } = data || {};

	const { featureResponse, role, user } = useSelector<AppState, AppReducer>(
		(state) => state.app,
	);

	const isDarkMode = useIsDarkMode();

	const [dashboardLayout, setDashboardLayout] = useState<Layout[]>([]);

	const updateDashboardMutation = useUpdateDashboard();

	const { notifications } = useNotifications();
	const urlQuery = useUrlQuery();

	let permissions: ComponentTypes[] = ['save_layout', 'add_panel'];

	if (isDashboardLocked) {
		permissions = ['edit_locked_dashboard', 'add_panel_locked_dashboard'];
	}

	const userRole: ROLES | null =
		selectedDashboard?.created_by === user?.email
			? (USER_ROLES.AUTHOR as ROLES)
			: role;

	const [saveLayoutPermission, addPanelPermission] = useComponentPermission(
		permissions,
		userRole,
	);

	useEffect(() => {
		setDashboardLayout(layouts);
	}, [layouts]);

	const onSaveHandler = (): void => {
		if (!selectedDashboard) return;

		const updatedDashboard: Dashboard = {
			...selectedDashboard,
			data: {
				...selectedDashboard.data,
				layout: dashboardLayout.filter((e) => e.i !== PANEL_TYPES.EMPTY_WIDGET),
			},
			uuid: selectedDashboard.uuid,
		};

		updateDashboardMutation.mutate(updatedDashboard, {
			onSuccess: (updatedDashboard) => {
				if (updatedDashboard.payload) {
					if (updatedDashboard.payload.data.layout)
						setLayouts(updatedDashboard.payload.data.layout);
					setSelectedDashboard(updatedDashboard.payload);
				}

				featureResponse.refetch();
			},
			onError: () => {
				notifications.error({
					message: SOMETHING_WENT_WRONG,
				});
			},
		});
	};

	const widgetActions = !isDashboardLocked
		? [...ViewMenuAction, ...EditMenuAction]
		: [...ViewMenuAction];

	const handleLayoutChange = (layout: Layout[]): void => {
		const filterLayout = removeUndefinedValuesFromLayout(layout);
		const filterDashboardLayout = removeUndefinedValuesFromLayout(
			dashboardLayout,
		);
		if (!isEqual(filterLayout, filterDashboardLayout)) {
			setDashboardLayout(layout);
		}
	};

	const onDragSelect = useCallback(
		(start: number, end: number) => {
			const startTimestamp = Math.trunc(start);
			const endTimestamp = Math.trunc(end);

			urlQuery.set(QueryParams.startTime, startTimestamp.toString());
			urlQuery.set(QueryParams.endTime, endTimestamp.toString());
			const generatedUrl = `${pathname}?${urlQuery.toString()}`;
			history.replace(generatedUrl);

			if (startTimestamp !== endTimestamp) {
				dispatch(UpdateTimeInterval('custom', [startTimestamp, endTimestamp]));
			}
		},
		[dispatch, pathname, urlQuery],
	);

	useEffect(() => {
		if (
			dashboardLayout &&
			Array.isArray(dashboardLayout) &&
			dashboardLayout.length > 0 &&
			!isEqual(layouts, dashboardLayout) &&
			!isDashboardLocked &&
			saveLayoutPermission &&
			!updateDashboardMutation.isLoading
		) {
			onSaveHandler();
		}

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dashboardLayout]);

	const isDashboardEmpty = useMemo(
		() =>
			selectedDashboard?.data.layout
				? selectedDashboard?.data.layout?.length === 0
				: true,
		[selectedDashboard],
	);

	console.log(isDashboardEmpty, selectedDashboard?.data.layout);

	return isDashboardEmpty ? (
		<DashboardEmptyState />
	) : (
		<FullScreen handle={handle} className="fullscreen-grid-container">
			<ReactGridLayout
				cols={12}
				rowHeight={100}
				autoSize
				width={100}
				useCSSTransforms
				isDraggable={!isDashboardLocked && addPanelPermission}
				isDroppable={!isDashboardLocked && addPanelPermission}
				isResizable={!isDashboardLocked && addPanelPermission}
				allowOverlap={false}
				onLayoutChange={handleLayoutChange}
				draggableHandle=".drag-handle"
				layout={dashboardLayout}
				style={{ backgroundColor: isDarkMode ? '' : themeColors.snowWhite }}
			>
				{dashboardLayout.map((layout) => {
					const { i: id } = layout;
					const currentWidget = (widgets || [])?.find((e) => e.id === id);

					return (
						<CardContainer
							className={isDashboardLocked ? '' : 'enable-resize'}
							isDarkMode={isDarkMode}
							key={id}
							data-grid={JSON.stringify(currentWidget)}
						>
							<Card
								className="grid-item"
								$panelType={currentWidget?.panelTypes || PANEL_TYPES.TIME_SERIES}
							>
								<GridCard
									widget={currentWidget || ({ id, query: {} } as Widgets)}
									headerMenuList={widgetActions}
									variables={variables}
									version={selectedDashboard?.data?.version}
									onDragSelect={onDragSelect}
								/>
							</Card>
						</CardContainer>
					);
				})}
			</ReactGridLayout>
		</FullScreen>
	);
}

export default GraphLayout;
