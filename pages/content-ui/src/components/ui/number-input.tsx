import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  showControls?: boolean
  formatValue?: (value: number) => string
  parseValue?: (value: string) => number
}

const NumberInput = React.forwardRef<HTMLDivElement, NumberInputProps>(
  (
    {
      className,
      value,
      onChange,
      min = 0,
      max = Infinity,
      step = 1,
      disabled,
      showControls = true,
      formatValue = (v) => v.toString(),
      parseValue = (v) => parseInt(v, 10),
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState(formatValue(value))

    // Update the displayed input value when the actual value changes
    React.useEffect(() => {
      setInputValue(formatValue(value))
    }, [value, formatValue])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value
      setInputValue(inputVal)
      
      const parsedValue = parseValue(inputVal)
      if (!isNaN(parsedValue)) {
        const clampedValue = Math.max(min, Math.min(max, parsedValue))
        onChange(clampedValue)
      }
    }

    const handleBlur = () => {
      // Reset the input value to match the actual value on blur
      setInputValue(formatValue(value))
    }

    const increment = () => {
      if (disabled) return
      const newValue = Math.min(max, value + step)
      onChange(newValue)
    }

    const decrement = () => {
      if (disabled) return
      const newValue = Math.max(min, value - step)
      onChange(newValue)
    }

    return (
      <div 
        ref={ref}
        className={cn(
          "relative flex w-full items-center",
          className
        )}
      >
        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className="w-full pr-8 rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        {showControls && (
          <div className="absolute right-0 h-full flex flex-col">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-[50%] w-8 rounded-none rounded-tr-md border-l border-input bg-white hover:bg-gray-50 px-0"
              onClick={increment}
              disabled={disabled || value >= max}
              tabIndex={-1}
            >
              <ChevronUp className="h-3 w-3" />
              <span className="sr-only">Increase</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-[50%] w-8 rounded-none rounded-br-md border-l border-t border-input bg-white hover:bg-gray-50 px-0"
              onClick={decrement}
              disabled={disabled || value <= min}
              tabIndex={-1}
            >
              <ChevronDown className="h-3 w-3" />
              <span className="sr-only">Decrease</span>
            </Button>
          </div>
        )}
      </div>
    )
  }
)
NumberInput.displayName = "NumberInput"

export { NumberInput } 