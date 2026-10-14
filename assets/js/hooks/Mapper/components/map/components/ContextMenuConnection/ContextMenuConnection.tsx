import { ConnectionType, MassState, ShipSizeStatus, SolarSystemConnection, TimeStatus } from '@/hooks/Mapper/types';
import clsx from 'clsx';
import { PrimeIcons } from 'primereact/api';
import { ContextMenu } from 'primereact/contextmenu';
import { MenuItem } from 'primereact/menuitem';
import React, { RefObject, useMemo, useState } from 'react';
import { Edge } from 'reactflow';
import { LifetimeActionsWrapper } from '@/hooks/Mapper/components/map/components/ContextMenuConnection/LifetimeActionsWrapper.tsx';
import { MassStatusActionsWrapper } from '@/hooks/Mapper/components/map/components/ContextMenuConnection/MassStatusActionsWrapper.tsx';
import { SaveMassReasonDialog } from '@/hooks/Mapper/components/map/components/ContextMenuConnection/SaveMassReasonDialog.tsx';
import classes from './ContextMenuConnection.module.scss';
import { getSystemStaticInfo } from '@/hooks/Mapper/mapRootProvider/hooks/useLoadSystemStatic.ts';
import { isNullsecSpace } from '@/hooks/Mapper/components/map/helpers/isKnownSpace.ts';

export interface ContextMenuConnectionProps {
  contextMenuRef: RefObject<ContextMenu>;
  onDeleteConnection(): void;
  onChangeTimeState(lifetime: TimeStatus): void;
  onChangeMassState(state: MassState): void;
  onChangeShipSizeStatus(state: ShipSizeStatus): void;
  onChangeType(type: ConnectionType): void;
  onToggleMassSave(isLocked: boolean, reason?: string, sourceTarget?: { source: string; target: string }): void;
  onToggleLoop(): void;
  onHide(): void;
  edge?: Edge<SolarSystemConnection>;
}

export const ContextMenuConnection: React.FC<ContextMenuConnectionProps> = ({
  contextMenuRef,
  onDeleteConnection,
  onChangeTimeState,
  onChangeMassState,
  onChangeShipSizeStatus,
  onChangeType,
  onToggleMassSave,
  onToggleLoop,
  onHide,
  edge,
}) => {
  // The save-mass flag needs a reason before it is applied, so the menu item
  // only records the pending direction here; the dialog drives the actual
  // toggle. Unlocking stays immediate — no reason required to un-save.
  const [pendingLock, setPendingLock] = useState<{ source: string; target: string } | null>(null);

  const closeReasonDialog = () => setPendingLock(null);

  const handleReasonSave = (reason: string) => {
    if (pendingLock) {
      // Explicit coordinates: the menu's onHide already cleared the hook's
      // `edge` by the time the dialog's Save fires.
      onToggleMassSave(true, reason, pendingLock);
    }

    closeReasonDialog();
  };

  const items: MenuItem[] = useMemo(() => {
    if (!edge) {
      return [];
    }

    const sourceInfo = getSystemStaticInfo(edge.data?.source);
    const targetInfo = getSystemStaticInfo(edge.data?.target);

    const bothNullsec =
      sourceInfo && targetInfo && isNullsecSpace(sourceInfo.system_class) && isNullsecSpace(targetInfo.system_class);

    const isFrigateSize = edge.data?.ship_size_type === ShipSizeStatus.small;
    const isLoop = edge.data?.type === ConnectionType.loop;
    // No `isWormholeType` binding: the bridge and gate types return early
    // above, so everything reaching the menu below is already wormhole-or-loop.

    if (edge.data?.type === ConnectionType.bridge) {
      return [
        {
          label: `Set as Wormhole`,
          icon: 'pi hero-arrow-uturn-left',
          command: () => onChangeType(ConnectionType.wormhole),
        },
        {
          label: 'Disconnect',
          icon: PrimeIcons.TRASH,
          command: onDeleteConnection,
        },
      ];
    }

    if (edge.data?.type === ConnectionType.gate) {
      return [
        {
          label: 'Disconnect',
          icon: PrimeIcons.TRASH,
          command: onDeleteConnection,
        },
      ];
    }

    return [
      {
        className: clsx(classes.FastActions, '!h-[54px]'),
        template: () => {
          return <LifetimeActionsWrapper lifetime={edge.data?.time_status} onChangeLifetime={onChangeTimeState} />;
        },
      },
      ...(!isFrigateSize
        ? [
            {
              className: clsx(classes.FastActions, '!h-[54px]'),
              template: () => {
                return (
                  <MassStatusActionsWrapper
                    massStatus={edge.data?.mass_status}
                    onChangeMassStatus={onChangeMassState}
                  />
                );
              },
            },
          ]
        : []),
      {
        label: `Loop`,
        className: clsx({
          [classes.ConnectionLoop]: isLoop,
        }),
        icon: PrimeIcons.REPLAY,
        command: onToggleLoop,
      },
      {
        label: `Frigate`,
        className: clsx({
          [classes.ConnectionFrigate]: isFrigateSize,
        }),
        icon: PrimeIcons.CLOUD,
        command: () =>
          onChangeShipSizeStatus(
            edge.data?.ship_size_type === ShipSizeStatus.small ? ShipSizeStatus.large : ShipSizeStatus.small,
          ),
      },
      {
        label: `Save mass`,
        className: clsx({
          [classes.ConnectionSave]: edge.data?.locked,
        }),
        icon: PrimeIcons.LOCK,
        command: () => {
          if (edge.data?.locked) {
            onToggleMassSave(false);
            return;
          }

          setPendingLock({ source: edge.source, target: edge.target });
        },
      },
      ...(bothNullsec
        ? [
            {
              label: `Set as Bridge`,
              icon: 'pi hero-forward',
              command: () => onChangeType(ConnectionType.bridge),
            },
          ]
        : []),
      {
        label: 'Disconnect',
        icon: PrimeIcons.TRASH,
        command: onDeleteConnection,
      },
    ];
  }, [
    edge,
    onChangeTimeState,
    onDeleteConnection,
    onChangeType,
    onChangeShipSizeStatus,
    onToggleMassSave,
    onToggleLoop,
    onChangeMassState,
  ]);

  return (
    <>
      <ContextMenu model={items} ref={contextMenuRef} onHide={onHide} breakpoint="767px" className="!w-[250px]" />
      <SaveMassReasonDialog
        visible={pendingLock != null}
        onHide={closeReasonDialog}
        onSave={handleReasonSave}
      />
    </>
  );
};
