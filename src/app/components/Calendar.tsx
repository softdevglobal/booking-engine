"use client";
import React, { useState, useEffect } from "react";

const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function hasNameString(value: unknown): value is { name: string } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { [key: string]: unknown };
  return typeof candidate['name'] === 'string';
}

interface BookingInfo {
  bookingId: string;
  startTime: string;
  endTime: string;
  customerName: string;
  eventType: string;
  status: string;
}

interface UnavailableDates {
  [date: string]: {
    [resourceId: string]: BookingInfo[];
  };
}

interface CalendarProps {
  resourceId?: string;
  resourceName?: string;
  hallOwnerId?: string;
  onDateSelect?: (date: { day: number; month: number; year: number; resourceId?: string }) => void;
}

export default function Calendar({ resourceId, resourceName, hallOwnerId, onDateSelect }: CalendarProps) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selected, setSelected] = useState<{ day: number; month: number; year: number } | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDates>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  useEffect(() => {
    if (!hallOwnerId) return;
    const fetchUnavailableDates = async (retryCount = 0) => {
      try {
        setLoading(true);
        setError(null);
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        const params = new URLSearchParams({ startDate, endDate });
        if (resourceId) params.append('resourceId', resourceId);
        const url = `/api/bookings/unavailable-dates/${hallOwnerId}?${params}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        if (response.ok) {
          const data = await response.json();
          setUnavailableDates(data.unavailableDates || {});
          setError(null);
        } else {
          const errorText = await response.text();
          let errorMessage = '';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || `Server error: ${response.status}`;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          if (retryCount < 2) {
            setTimeout(() => fetchUnavailableDates(retryCount + 1), 2000);
            return;
          }
          setError(errorMessage);
          setUnavailableDates({});
        }
      } catch (err: unknown) {
        const errorName = hasNameString(err) ? err.name : undefined;
        const isAbort = errorName === 'AbortError' || errorName === 'TimeoutError';
        if (retryCount < 2 && !isAbort) {
          setTimeout(() => fetchUnavailableDates(retryCount + 1), 2000);
          return;
        }
        if (isAbort) {
          setError('Request timeout - please check if backend server is running');
        } else {
          setError('Network error - please check if backend server is running on port 5000');
        }
        setUnavailableDates({});
        setOfflineMode(true);
      } finally {
        setLoading(false);
      }
    };
    fetchUnavailableDates();
  }, [year, month, resourceId, hallOwnerId, daysInMonth]);

  const isDateUnavailable = (day: number): boolean => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!unavailableDates[dateString]) return false;
    if (!resourceId) return Object.keys(unavailableDates[dateString]).length > 0;
    return unavailableDates[dateString][resourceId] && unavailableDates[dateString][resourceId].length > 0;
  };

  const getBookingInfo = (day: number): BookingInfo[] => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!unavailableDates[dateString]) return [];
    if (!resourceId) {
      const allBookings: BookingInfo[] = [];
      Object.values(unavailableDates[dateString]).forEach(bookings => { allBookings.push(...bookings); });
      return allBookings;
    }
    return unavailableDates[dateString][resourceId] || [];
  };

  const handlePrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else { setMonth(month - 1); }
  };
  const handleNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else { setMonth(month + 1); }
  };
  const handleSelect = (day: number) => {
    const selectedDate = { day, month, year };
    setSelected(selectedDate);
    if (onDateSelect) onDateSelect({ ...selectedDate, resourceId });
  };

  const buttons = [];
  for (let i = 0; i < firstDay; i++) buttons.push(<div key={"empty-" + i}></div>);
  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected = selected && selected.day === d && selected.month === month && selected.year === year;
    const isUnavailable = isDateUnavailable(d);
    const isPast = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const bookingInfo = getBookingInfo(d);
    let buttonClass = "h-12 w-full rounded-full text-base font-medium leading-normal ";
    if (isSelected) buttonClass += "bg-[#ec8013] text-white";
    else if (isPast) buttonClass += "bg-gray-100 text-gray-400 cursor-not-allowed";
    else if (isUnavailable) buttonClass += "bg-red-100 text-red-600 cursor-not-allowed";
    else buttonClass += "hover:bg-stone-100 text-[#181411]";
    buttons.push(
      <button
        key={d}
        className={buttonClass}
        onClick={() => !isPast && !isUnavailable ? handleSelect(d) : undefined}
        disabled={isPast || isUnavailable}
        title={isUnavailable ? `Booked: ${bookingInfo.map(b => `${b.startTime}-${b.endTime} (${b.eventType})`).join(', ')}` : undefined}
      >
        {d}
        {isUnavailable && (<div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>)}
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-1 p-4 bg-white rounded-lg shadow-md">
      {resourceName && (
        <div className="text-center mb-2">
          <h4 className="text-sm font-semibold text-[#181411]">{resourceName}</h4>
          <p className="text-xs text-[#897561]">Availability</p>
        </div>
      )}
      {loading && (
        <div className="text-center py-2">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#ec8013]"></div>
          <p className="text-xs text-[#897561] mt-1">Loading availability...</p>
        </div>
      )}
      {error && (
        <div className="text-center py-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-600 mb-2">{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setError(null);
                  setOfflineMode(false);
                  const currentMonth = month;
                  setMonth(currentMonth === 11 ? 0 : currentMonth + 1);
                  setTimeout(() => setMonth(currentMonth), 100);
                }}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
              >
                Retry
              </button>
              {offlineMode && (
                <button
                  onClick={() => setError(null)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors"
                >
                  Continue Offline
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {offlineMode && !error && (
        <div className="text-center py-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <p className="text-xs text-yellow-700">
              ⚠️ Offline mode - availability data may not be current
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between p-2">
        <button className="text-[#181411] hover:text-[#ec8013] transition-colors rounded-full p-2" onClick={handlePrev}>
          <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
            <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path>
          </svg>
        </button>
        <p className="text-[#181411] text-lg sm:text-xl font-bold leading-tight text-center">
          {new Date(year, month, 1).toLocaleString("default", { month: "long" })} {year}
        </p>
        <button className="text-[#181411] hover:text-[#ec8013] transition-colors rounded-full p-2" onClick={handleNext}>
          <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
            <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {daysOfWeek.map((d, i) => (
          <p key={i} className="text-center text-[#897561] text-sm font-bold leading-normal tracking-[0.015em] py-2">{d}</p>
        ))}
        {buttons}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-200">
        <div className="flex flex-wrap gap-2 text-xs text-[#897561] justify-center">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded-full"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded-full"></div>
            <span>Past</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#ec8013] rounded-full"></div>
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}


