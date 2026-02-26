<template>
    <div id="clock">
        <p class="text-white">{{ time }}</p>
    </div>
</template>
<script>
    export default {
        name: 'Clock',
        data() {
            return {
                time: '',
                timerID:  setInterval(this.updateTime, 1000) ,
            }
        },
        props: {
            week: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
        },
        methods: {
            updateTime() {
                let cd = new Date();
                this.time = this.zeroPadding(cd.getHours(), 2) + ':' + this.zeroPadding(cd.getMinutes(), 2) + ':' + this.zeroPadding(cd.getSeconds(), 2);
            },
            zeroPadding(num, digit) {
                let zero = '';
                for (var i = 0; i < digit; i++) {
                    zero += '0';
                }
                return (zero + num).slice(-digit);
            }
        },
        mounted(){
            this.updateTime();
        }
    }
</script>
