
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
    setDisplay((parseFloat(display) * -1).toString());
  };

  const inputPercent = () => {
    setDisplay((parseFloat(display) / 100).toString());
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

  // --- BUTTON STYLES ---
  const btnBase = "h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-2xl font-medium transition-all active:scale-95 select-none";
  const btnNum = "bg-[#333333] text-white hover:bg-[#444]";
  const btnOp = "bg-[#ff9f0a] text-white hover:bg-[#ffb038]";
  const btnFunc = "bg-[#a5a5a5] text-black hover:bg-[#d4d4d4]";
  const btnZero = "col-span-2 w-auto pl-6 justify-start rounded-full bg-[#333333] text-white hover:bg-[#444]";

  // Helper to highlight active operator
  const getOpClass = (op: string) => {
    if (operator === op && waitingForNewValue) {
      return "bg-white text-[#ff9f0a] hover:bg-white"; // Active state inverted like iOS
    }
    return btnOp;
  };

  return (
    <div className="h-full w-full bg-black flex flex-col select-none">
      {/* Display Screen */}
      <div className="flex-1 flex items-end justify-end p-6 pb-2">
        <div className="text-white text-6xl font-light tracking-tight truncate">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-3 p-4 pb-6 max-w-md mx-auto w-full">
        {/* Row 1 */}
        <button className={btnFunc} onClick={clearDisplay}>{display === '0' && !prevValue ? 'AC' : 'C'}</button>
        <button className={btnFunc} onClick={toggleSign}>+/-</button>
        <button className={btnFunc} onClick={inputPercent}>%</button>
        <button className={getOpClass('/')} onClick={() => performOperation('/')}>÷</button>

        {/* Row 2 */}
        <button className={btnNum} onClick={() => inputDigit('7')}>7</button>
        <button className={btnNum} onClick={() => inputDigit('8')}>8</button>
        <button className={btnNum} onClick={() => inputDigit('9')}>9</button>
        <button className={getOpClass('*')} onClick={() => performOperation('*')}>×</button>

        {/* Row 3 */}
        <button className={btnNum} onClick={() => inputDigit('4')}>4</button>
        <button className={btnNum} onClick={() => inputDigit('5')}>5</button>
        <button className={btnNum} onClick={() => inputDigit('6')}>6</button>
        <button className={getOpClass('-')} onClick={() => performOperation('-')}>−</button>

        {/* Row 4 */}
        <button className={btnNum} onClick={() => inputDigit('1')}>1</button>
        <button className={btnNum} onClick={() => inputDigit('2')}>2</button>
        <button className={btnNum} onClick={() => inputDigit('3')}>3</button>
        <button className={getOpClass('+')} onClick={() => performOperation('+')}>+</button>

        {/* Row 5 */}
        <button className={btnZero} onClick={() => inputDigit('0')}>0</button>
        <button className={btnNum} onClick={inputDecimal}>,</button>
        <button className={btnOp} onClick={() => performOperation('=')}>=</button>
      </div>
    </div>
  );
};
