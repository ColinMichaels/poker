<template>
    <div class="fixed top-0 right-0 m-6" v-show="show">
        <transition name="slide-fade">
            <div
                v-if="message"
                :class="{
            'bg-red-200 text-red-900' : message.type === 'error',
            'bg-green-200 text-green-900' : message.type === 'success',
            'bg-orange-200 text-orange-900' : message.type === 'warning'
            }"
                class="rounded-lg shadow-md p-6 pr-10"
                style="min-width: 240px"
            >
                <button @click="close()"
                    class="opacity-75 cursor-pointer absolute top-0 right-0 py-2 px-3 hover:opacity-100"
                >
                    ×
                </button>
                <div class="flex items-center">
                    {{ message.text }}
                </div>
            </div>
        </transition>
    </div>
</template>

<script>
    export default {
        name: "FlashMessage",
        data() {
            return {
                message: {
                    text: 'Hey! Something awesome happened,',
                    type: 'success',
                },
                show : false
            }
        },
        mounted() {
            let timer;
            Bus.$on('flash-message', (message) => {
                clearTimeout(timer);
                this.show = true;

                this.message = message;

                timer = setTimeout(() => {
                    this.message = null;
                    this.show = false;
                }, 5000);
            });
        },
        methods:{
            close(){
                this.show = false;
            }
        }
    }
</script>

<style scoped>
    .slide-fade-enter{
        opacity : 0;
        transform: translateX(400px);
    }
    .slide-fade-enter-active,
    .slide-fade-leave-active {
        transition: all 0.4s;
    }
    .slide-fade-enter,
    .slide-fade-leave-to {
        transform: translateX(400px);
        opacity: 0;
    }
</style>
