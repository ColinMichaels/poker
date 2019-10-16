<template>
    <div>
        <div class="flex flex-column p-4" v-show="active">
            <fieldset class="calculator flex flex-column flex-wrap">
                <div class="display"></div>
                <div class="keys flex flex-wrap">
                    <button class="btn-number btn">7</button>
                    <button class="btn-number btn">8</button>
                    <button class="btn-number btn">9</button>
                    <button class="btn-operator btn" data-action="divide">÷</button>
                    <button class="btn-number btn">4</button>
                    <button class="btn-number btn">5</button>
                    <button class="btn-number btn">6</button>
                    <button class="btn-operator btn" data-action="multiply">&times;</button>
                    <button class="btn-number btn">1</button>
                    <button class="btn-number btn">2</button>
                    <button class="btn-number btn">3</button>
                    <button class="btn-operator btn" data-action="subtract">-</button>
                    <button class="btn-number btn">0</button>
                    <button class="btn-decimal btn-number btn" data-action="decimal">.</button>
                    <button class="btn-equals btn" data-action="calculate">=</button>
                    <button class="btn-operator btn" data-action="add">+</button>
                    <button class="btn-operator btn-clr btn" data-action="clear">C</button>
                </div>
            </fieldset>
        </div>
    </div>
</template>

<script>
    export default {
        name: "Calculator",
        data() {
            return {
                active: true
            }
        },
        methods: {
            calculator() {
                const calc = document.querySelector('.calculator');
                const keys = document.querySelector('.keys');
                const display = document.querySelector('.display');

                keys.addEventListener('click', e => {
                    if (e.target.matches('button')) {
                        const key = e.target;
                        const action = key.dataset.action;
                        const keyContent = key.textContent;
                        const displayedNum = display.textContent;
                        const previousKeyType = calc.dataset.previousKeyType;

                        Array.from(key.parentNode.children)
                            .forEach(k => k.classList.remove('is-depressed'));

                        if (!action) {
                            if (displayedNum === '0' || previousKeyType === 'operator') {
                                display.textContent = keyContent
                            } else {
                                display.textContent = displayedNum + keyContent
                            }
                            calc.dataset.previousKeyType = keyContent;
                        }

                        if (
                            action === 'add' ||
                            action === 'subtract' ||
                            action === 'multiply' ||
                            action === 'divide'
                        ) {
                            key.classList.add('is-depressed');
                            calc.dataset.firstValue = displayedNum;
                            calc.dataset.operator = action;
                            calc.dataset.previousKeyType = 'operator';
                        }

                        if (action === 'decimal') {
                            display.textContent = displayedNum + '.';
                        }

                        if (action === 'clear') {
                            display.textContent = '';
                        }

                        if (action === 'calculate') {
                            const firstValue = calc.dataset.firstValue;
                            const operator = calc.dataset.operator;
                            display.textContent = this.calculate(firstValue, operator, displayedNum);
                        }
                    }
                }, false);
                /* numpad */
                document.addEventListener('keydown', keyboardType);

                function keyboardType(e) {
                    let key = Number(e.key);
                    const keyContent = e.key;
                    const displayedNum = display.textContent;
                    const previousKeyType = calc.dataset.previousKeyType;
                    if (isNaN(key) || key === null) {
                        if (keyContent === '+' ||
                            keyContent === '-' ||
                            keyContent === '*' ||
                            keyContent === '/' ||
                            keyContent === '.') {

                            switch (keyContent) {
                                case "+":
                                    calc.dataset.operator = 'add';
                                    break;
                                case "-":
                                    calc.dataset.operator = 'subtract';
                                    break;
                                case "*":
                                    calc.dataset.operator = 'multiply';
                                    break;
                                case "/":
                                    calc.dataset.operator = 'divide';
                                    break;
                            }
                            calc.dataset.firstValue = displayedNum;
                            calc.dataset.previousKeyType = 'operator';
                        }

                        if (keyContent === 'Enter') {
                            e.preventDefault();
                            const firstValue = calc.dataset.firstValue;
                            const operator = calc.dataset.operator;
                            display.textContent = this.calculate(firstValue, operator, displayedNum);
                        }

                        if (keyContent === 'Backspace' || keyContent === 'Delete') {
                            display.textContent = '';
                        }

                    } else {
                        if (keyContent >= 0 && keyContent <= 9) {
                            // 0-9 only
                            if (displayedNum === '0' || previousKeyType === 'operator') {
                                display.textContent = keyContent
                            } else {
                                display.textContent = displayedNum + keyContent
                            }
                            calc.dataset.previousKeyType = keyContent;
                        }
                    }
                }
            },
            calculate(n1, operator, n2) {
                let result = '';

                if (operator === 'add') {
                    result = parseFloat(n1) + parseFloat(n2)
                } else if (operator === 'subtract') {
                    result = parseFloat(n1) - parseFloat(n2)
                } else if (operator === 'multiply') {
                    result = parseFloat(n1) * parseFloat(n2)
                } else if (operator === 'divide') {
                    result = parseFloat(n1) / parseFloat(n2)
                }
                return result
            }
        },
        mounted() {
            this.calculator();
        }
    }
</script>

<style scoped>

    fieldset.calculator {
        @apply bg-gray-100 shadow text-right;
    }

    .btn {
        @apply p-3 rounded bg-blue-500;
    }

    .btn.is-depressed {
        @apply bg-orange-600;
        box-shadow: inset 0 0 10px black;
    }

    .btn-number {
        @apply w-3/12 my-1 mx-1;
    }

    .btn-operator {
        @apply font-bold text-white text-2xl leading-snug bg-gray-700 m-1 w-10 font-mono;
    }

    .btn-equals {
        @apply w-3/12 m-1 bg-gray-500 text-black;
    }

    .display {
        @apply w-full mb-4 p-2 h-8 text-2xl border-2 border-gray-400 text-right font-mono text-black;
        min-height: 60px;
        box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
    }
</style>
