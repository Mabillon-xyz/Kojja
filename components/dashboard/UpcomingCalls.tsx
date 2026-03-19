export type CallSlot = { name: string; time: string }
export type DaySlot = {
  iso: string
  dayLabel: string
  dateNum: number
  monthLabel: string
  isToday: boolean
  isPast?: boolean
  calls: CallSlot[]
}

export default function UpcomingCalls({ days, noDateCalls }: { days: DaySlot[]; noDateCalls?: string[] }) {
  // Only render past days if they have calls (overdue)
  const visibleDays = days.filter((d) => !d.isPast || d.calls.length > 0)
  const hasCalls = visibleDays.some((d) => d.calls.length > 0)
  const hasNoDate = noDateCalls && noDateCalls.length > 0
  const isEmpty = !hasCalls && !hasNoDate

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-900">Upcoming first calls</h2>
        <p className="text-xs text-neutral-400 mt-0.5">Next 14 days + overdue — test leads excluded</p>
      </div>

      {hasNoDate && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-amber-600 font-semibold uppercase tracking-wide">No date set:</span>
          {noDateCalls!.map((name) => (
            <span key={name} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
              {name}
            </span>
          ))}
        </div>
      )}

      {isEmpty ? (
        <p className="text-sm text-neutral-400 py-4 text-center">No calls scheduled in the next 14 days.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <div className="flex gap-2 px-1 min-w-max">
            {visibleDays.map((day) => {
              const isOverdue = !!day.isPast && day.calls.length > 0
              return (
                <div
                  key={day.iso}
                  className={`flex flex-col w-28 rounded-lg p-3 border transition-colors ${
                    day.isToday
                      ? 'border-neutral-900 bg-neutral-900'
                      : isOverdue
                      ? 'border-red-200 bg-red-50'
                      : day.calls.length > 0
                      ? 'border-neutral-200 bg-neutral-50'
                      : 'border-neutral-100 bg-white'
                  }`}
                >
                  {/* Date header */}
                  <div className="mb-2">
                    {isOverdue && (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-red-500 mb-0.5">Overdue</p>
                    )}
                    <p className={`text-[10px] font-medium uppercase tracking-wide ${
                      day.isToday ? 'text-neutral-400' : isOverdue ? 'text-red-400' : 'text-neutral-400'
                    }`}>
                      {day.dayLabel}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold leading-none ${
                        day.isToday ? 'text-white' : isOverdue ? 'text-red-600' : 'text-neutral-900'
                      }`}>
                        {day.dateNum}
                      </span>
                      <span className={`text-[10px] ${
                        day.isToday ? 'text-neutral-400' : isOverdue ? 'text-red-400' : 'text-neutral-400'
                      }`}>
                        {day.monthLabel}
                      </span>
                    </div>
                  </div>

                  {/* Calls */}
                  <div className="space-y-1.5">
                    {day.calls.length === 0 ? (
                      <div className="h-3" />
                    ) : (
                      day.calls.map((call, i) => (
                        <div key={i} className={`rounded-md px-2 py-1.5 ${
                          day.isToday ? 'bg-white/10' : isOverdue ? 'bg-white border border-red-200' : 'bg-white border border-neutral-200'
                        }`}>
                          <p className={`text-[10px] font-medium ${
                            day.isToday ? 'text-neutral-300' : isOverdue ? 'text-red-400' : 'text-neutral-500'
                          }`}>{call.time}</p>
                          <p className={`text-xs font-semibold leading-tight mt-0.5 ${
                            day.isToday ? 'text-white' : isOverdue ? 'text-red-700' : 'text-neutral-800'
                          }`}>
                            {call.name}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
