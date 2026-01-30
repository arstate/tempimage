
import React, { useState } from 'react';

export const CalculatorApp = () => {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearDisplay = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  };

  const toggleSign = () => {
    const val = parseFloat(display);
    if (val === 0) return;
    setDisplay((val * -1).toString());
  };

  const inputPercent = () => {
    const val = parseFloat(display);
    if (val === 0) return;
    setDisplay((val / 100).toString());
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(display);
    } else if (operator) {
      const prev = parseFloat(prevValue);
      const newValue = calculate(prev, inputValue, operator);
      setPrevValue(String(newValue));
      setDisplay(String(newValue));
    }

    setWaitingForNewValue(true);
    setOperator(nextOperator);
  };

  const calculate = (prev: number, next: number, op: string) => {
    switch (op) {
      case '+': return prev + next;
      case '-': return prev - next;
      case '*': return prev * next;
      case '/': return prev / next;
      default: return next;
    }
  };

  // Styles
  const getOpClass = (op: string) => {
    if (operator === op && waitingForNewValue) {
      return "bg-[#cc7a00] text-white"; // Active state darker orange
    }
    return "bg-[#ff9f0a] hover:bg-[#ffb038] active:bg-[#d98300]";
  };

  const btnNum = "bg-[#3a3a3c] hover:bg-[#4a4a4c] active:bg-[#5a5a5c] text-white text-3xl font-light focus:outline-none transition-colors duration-100";
  const btnFunc = "bg-[#505050] hover:bg-[#606060] active:bg-[#707070] text-white text-2xl focus:outline-none transition-colors duration-100";
  const btnOp = "text-white text-3xl font-light pb-1 focus:outline-none transition-colors duration-100";

  // Fit text logic
  const getFontSize = () => {
    if (display.length > 11) return 'text-3xl';
    if (display.length > 9) return 'text-4xl';
    if (display.length > 6) return 'text-5xl';
    return 'text-6xl';
  }

  return (
    <div className="h-full w-full bg-black flex flex-col select-none font-sans">
      {/* Display Screen */}
      <div className="h-32 flex items-end justify-end px-4 pb-4 bg-[#1c1c1c]">
        <div className={`${getFontSize()} font-light tracking-tight text-white truncate w-full text-right`}>
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="flex-1 grid grid-cols-4 grid-rows-5 gap-[1px] bg-[#1c1c1c]">
        {/* Row 1 */}
        <button className={btnFunc} onClick={clearDisplay}>{display === '0' && !prevValue ? 'AC' : 'C'}</button>
        <button className={btnFunc} onClick={toggleSign}>+/-</button>
        <button className={btnFunc} onClick={inputPercent}>%</button>
        <button className={`${getOpClass('/')} ${btnOp}`} onClick={() => performOperation('/')}>÷</button>

        {/* Row 2 */}
        <button className={btnNum} onClick={() => inputDigit('7')}>7</button>
        <button className={btnNum} onClick={() => inputDigit('8')}>8</button>
        <button className={btnNum} onClick={() => inputDigit('9')}>9</button>
        <button className={`${getOpClass('*')} ${btnOp}`} onClick={() => performOperation('*')}>×</button>

        {/* Row 3 */}
        <button className={btnNum} onClick={() => inputDigit('4')}>4</button>
        <button className={btnNum} onClick={() => inputDigit('5')}>5</button>
        <button className={btnNum} onClick={() => inputDigit('6')}>6</button>
        <button className={`${getOpClass('-')} ${btnOp}`} onClick={() => performOperation('-')}>−</button>

        {/* Row 4 */}
        <button className={btnNum} onClick={() => inputDigit('1')}>1</button>
        <button className={btnNum} onClick={() => inputDigit('2')}>2</button>
        <button className={btnNum} onClick={() => inputDigit('3')}>3</button>
        <button className={`${getOpClass('+')} ${btnOp}`} onClick={() => performOperation('+')}>+</button>

        {/* Row 5 */}
        <button className={`${btnNum} col-span-2 pl-7 text-left`} onClick={() => inputDigit('0')}>0</button>
        <button className={btnNum} onClick={inputDecimal}>.</button>
        <button className={`${getOpClass('=')} ${btnOp} bg-[#ff9f0a] hover:bg-[#ffb038] active:bg-[#d98300]`} onClick={() => performOperation('=')}>=</button>
      </div>
    </div>
  );
};
