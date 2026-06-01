import React from 'react';
import { PortalIcon } from './PortalIcon';
import { isoToDisplayDate, normalizeDateEntry, normalizeDateForPicker } from '../lib/dateInput';

export function DateInputField({
  className = '',
  disabled = false,
  max = '',
  min = '',
  name,
  onChange,
  placeholder = 'dd/mm/yyyy',
  required = false,
  value,
}) {
  const pickerRef = React.useRef(null);
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(value ?? '');
  const currentValue = controlled ? value ?? '' : internalValue;

  React.useEffect(() => {
    if (controlled) {
      setInternalValue(value ?? '');
    }
  }, [controlled, value]);

  function emitChange(nextValue) {
    if (!controlled) {
      setInternalValue(nextValue);
    }

    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    });
  }

  function handleTextChange(event) {
    emitChange(normalizeDateEntry(event.target.value));
  }

  function handlePickerChange(event) {
    emitChange(isoToDisplayDate(event.target.value));
  }

  function openPicker() {
    if (!pickerRef.current || disabled) {
      return;
    }

    if (typeof pickerRef.current.showPicker === 'function') {
      pickerRef.current.showPicker();
      return;
    }

    pickerRef.current.focus();
    pickerRef.current.click();
  }

  return (
    <span className={`date-input-field ${className}`.trim()}>
      <input
        className="date-input-field__text"
        disabled={disabled}
        name={name}
        onChange={handleTextChange}
        pattern="\d{2}/\d{2}/\d{4}"
        placeholder={placeholder}
        required={required}
        type="text"
        value={currentValue}
      />
      <button
        aria-label={`Open calendar for ${name}`}
        className="date-input-field__button"
        disabled={disabled}
        onClick={openPicker}
        type="button"
      >
        <PortalIcon className="date-input-field__icon" name="calendar" />
      </button>
      <input
        aria-hidden="true"
        className="date-input-field__native-picker"
        disabled={disabled}
        max={normalizeDateForPicker(max)}
        min={normalizeDateForPicker(min)}
        onChange={handlePickerChange}
        ref={pickerRef}
        tabIndex={-1}
        type="date"
        value={normalizeDateForPicker(currentValue)}
      />
    </span>
  );
}
