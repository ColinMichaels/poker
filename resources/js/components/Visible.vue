<template>
    <transition name="fade">
        <div v-show="shouldDisplay">
            <slot></slot>
        </div>
    </transition>
</template>

<script>
    import inViewport from 'in-viewport';

    export default {
        name: "Visible",
        props: ['whenHidden'],
        data() {
            return {
                shouldDisplay: false
            }
        },
        mounted() {
            window.addEventListener('scroll', () => {
                this.shouldDisplay = !inViewport(
                    document.querySelector(this.whenHidden)
                )
            }, {passive: true})
        }
    }
</script>

<style scoped>

    .fade-enter-active, .fade-leave-active {
        transition: transform 1.4s ease-in-out;
    }

    .fade-enter, .fade-leave-to {
        opacity: 0;
        transform: translateX(220px);
    }

</style>
