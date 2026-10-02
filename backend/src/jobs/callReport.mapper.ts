/**
 * Call Report job mapping (CORE-01)
 *
 * The webhook controller flattens Vapi's end-of-call-report into job data and
 * the worker rebuilds the event from it. Both directions live here so a field
 * cannot be added on one side and silently dropped on the other — which is how
 * `artifact` (structured output + recording) and `costBreakdown` were lost.
 */

import type { CallReportJobData } from './callReport.queue';
import type { VapiEndOfCallReportEvent } from '../modules/calls/webhook.service';

/** Vapi event → BullMQ job payload (controller side). */
export function toCallReportJobData(ev: VapiEndOfCallReportEvent): CallReportJobData {
  return {
    vapiCallId:      ev.call.id,
    assistantId:     ev.call.assistantId,
    callType:        ev.call.type,
    callerNumber:    ev.call.customer?.number,
    endedReason:     ev.call.endedReason,
    durationSeconds: ev.durationSeconds,
    recordingUrl:    ev.recordingUrl,
    transcript:      ev.transcript,
    messages:        ev.messages,
    summary:         ev.summary,
    cost:            ev.cost,
    callCost:        ev.call.cost,
    costBreakdown:   ev.costBreakdown,
    artifact:        ev.artifact,
  };
}

/** BullMQ job payload → Vapi event shape (worker side). */
export function toEndOfCallEvent(data: CallReportJobData): VapiEndOfCallReportEvent {
  return {
    type: 'end-of-call-report',
    call: {
      id:          data.vapiCallId,
      assistantId: data.assistantId,
      type:        data.callType as VapiEndOfCallReportEvent['call']['type'],
      customer:    data.callerNumber ? { number: data.callerNumber } : undefined,
      endedReason: data.endedReason,
      cost:        data.callCost,
    },
    durationSeconds: data.durationSeconds,
    recordingUrl:    data.recordingUrl,
    transcript:      data.transcript,
    messages:        data.messages as VapiEndOfCallReportEvent['messages'],
    summary:         data.summary,
    cost:            data.cost,
    costBreakdown:   data.costBreakdown,
    artifact:        data.artifact,
  };
}
