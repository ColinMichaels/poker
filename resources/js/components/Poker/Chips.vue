<template>
    <div>
        <ul  class="w-1/2 flex">
            <li v-for="amount in this.amounts">
                <chip :amount="amount.toString()"></chip>
            </li>
        </ul>
    </div>
</template>

<script>
    import Chip from "./Chip";
    import {denominations} from "./denominations";
    export default {
        name: "Chips",
        components: {
          Chip
        },
        data(){
            return{
                amounts : denominations
            }
        }
    }
</script>

<style scoped>

</style>
