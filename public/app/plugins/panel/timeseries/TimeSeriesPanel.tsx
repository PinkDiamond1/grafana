import React, { useMemo } from 'react';
import { Field, LoadingState, PanelProps } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
import { GraphNGProps, TimeSeries, TooltipPlugin, usePanelContext, ZoomPlugin } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { TimeSeriesOptions } from './types';
import { prepareGraphableFields } from './utils';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { config } from 'app/core/config';
import { PanelDataErrorView } from '@grafana/runtime';
import { measureDataRenderDelay } from './measureDataRenderDelay';

export const createOnDataRenderDelay: (data: TimeSeriesPanelProps['data']) => GraphNGProps['onBeforeRerender'] = (
  data
) => {
  if (!config.livePerformance.measureDataRenderDelay || data.state !== LoadingState.Streaming) {
    return undefined;
  }

  return (props, newProps) => measureDataRenderDelay(props.frames, newProps.frames);
};

interface TimeSeriesPanelProps extends PanelProps<TimeSeriesOptions> {}

export const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
  id,
}) => {
  const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, onSplitOpen } = usePanelContext();
  const onBeforeRerender = createOnDataRenderDelay(data);

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
  };

  const frames = useMemo(() => prepareGraphableFields(data.series, config.theme2), [data]);

  if (!frames) {
    return <PanelDataErrorView panelId={id} data={data} needsTimeField={true} needsNumberField={true} />;
  }

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  return (
    <TimeSeries
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onBeforeRerender={onBeforeRerender}
    >
      {(config, alignedDataFrame) => {
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            {options.tooltip.mode === TooltipDisplayMode.None || (
              <TooltipPlugin
                data={alignedDataFrame}
                config={config}
                mode={options.tooltip.mode}
                sync={sync}
                timeZone={timeZone}
              />
            )}
            {/* Renders annotation markers*/}
            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}
            {/* Enables annotations creation*/}
            {enableAnnotationCreation ? (
              <AnnotationEditorPlugin data={alignedDataFrame} timeZone={timeZone} config={config}>
                {({ startAnnotating }) => {
                  return (
                    <ContextMenuPlugin
                      data={alignedDataFrame}
                      config={config}
                      timeZone={timeZone}
                      replaceVariables={replaceVariables}
                      defaultItems={[
                        {
                          items: [
                            {
                              label: 'Add annotation',
                              ariaLabel: 'Add annotation',
                              icon: 'comment-alt',
                              onClick: (e, p) => {
                                if (!p) {
                                  return;
                                }
                                startAnnotating({ coords: p.coords });
                              },
                            },
                          ],
                        },
                      ]}
                    />
                  );
                }}
              </AnnotationEditorPlugin>
            ) : (
              <ContextMenuPlugin
                data={alignedDataFrame}
                config={config}
                timeZone={timeZone}
                replaceVariables={replaceVariables}
                defaultItems={[]}
              />
            )}
            {data.annotations && (
              <ExemplarsPlugin
                config={config}
                exemplars={data.annotations}
                timeZone={timeZone}
                getFieldLinks={getFieldLinks}
              />
            )}

            {canEditThresholds && onThresholdsChange && (
              <ThresholdControlsPlugin
                config={config}
                fieldConfig={fieldConfig}
                onThresholdsChange={onThresholdsChange}
              />
            )}
          </>
        );
      }}
    </TimeSeries>
  );
};
