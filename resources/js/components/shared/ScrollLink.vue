<template>

    <a class="btn button" :href="href" @click.prevent="scroll">
        <slot></slot>
    </a>

</template>

<script>
    import smoothscroll from 'smoothscroll-polyfill';

    smoothscroll.polyfill();
    export default {
        name: "ScrollLink",
        props: ['href'],
        methods: {
            scroll() {
                document.querySelector(this.href)
                    .scrollIntoView({behavior: 'smooth'})
            }
        }
    }
</script>
