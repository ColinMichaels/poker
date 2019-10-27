<template>
	        <div>
                <h1 class="mb-8 font-bold text-3xl">Dashboard</h1>
                <p class="mb-12 leading-normal">Welcome To Poker</p>
            </div>
</template>

<script>
    import Layout from "@/Shared/Layout";
    import GameComponent from "@/plugins/game/GameComponent";
    export default {
        name: "index",
        components:{
            GameComponent
        },
        metaInfo: {
            title: 'Dashboard',
        },
        layout: Layout
    }
</script>

<style scoped>

</style>
