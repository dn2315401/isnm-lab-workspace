/** Date-cell background includes decorative descendants, but never existing controls/events. */
export function isCalendarCellBackground(target: Pick<Element,'closest'> | null) {
 return !!target&&!target.closest('button,a,input,select,textarea,[role="button"],.lc-event,.lc-time-event');
}
