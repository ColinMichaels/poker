<template>
    <div>
        <game-component name="Card Practice"></game-component>
    </div>
</template>

<script>
    import Layout from "@/Shared/Layout";
    import GameComponent from "@/plugins/game/GameComponent";
    export default {
        name: "index",
        components:{
            GameComponent,
        },
        metaInfo: {
            title: 'Poker',
        },
        layout: Layout
    }
</script>

<style scoped>

</style>
