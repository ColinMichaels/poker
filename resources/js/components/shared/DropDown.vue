<template>
    <div class="dropdown relative">
        <div class="dropdown-trigger"
             @click.prevent="isOpen = !isOpen"
             aria-haspopup="true"
             :aria-expanded="isOpen"
        >
            <slot name="trigger"></slot>
        </div>
        <transition name="pop-out-quick">
            <div v-show="isOpen" :class="classes">
                <slot></slot>
            </div>
        </transition>
    </div>
</template>

<script>
    export default {
        name: "DropDown",
        props: ['classes'],
        data() {
            return {
                isOpen: false
            }
        },
        watch: {
            isOpen(isOpen) {
                if (isOpen) {
                    document.addEventListener('click', this.closeIfClickedOutside);
                }
            }
        },
        methods: {
            closeIfClickedOutside(event) {
                if (!event.target.closest('.dropdown')) {
                    this.isOpen = false;
                }

            }
        }
    }
</script>
<style>
    .pop-out-quick-enter-active,
    .pop-out-quick-leave-active {
        transition: all 0.4s;
    }

    .pop-out-quick-enter,
    .pop-out-quick-leave-active {
        opacity: 0;
        transform: translateY(-7px);
    }

    .dropdown-menu {
        @apply absolute bg-black text-white py-2 shadow rounded mt-2 z-10;
    }

    .dropdown-menu-item {
        @apply text-xs block pl-2 pr-6;
    }

    .dropdown-menu-item:hover {
        @apply bg-gray-700;
    }

</style>

