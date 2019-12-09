<template>
    <div>
        <ul class="flex">
            <li v-for="denomination in this.denominations">
                <chip :amount="denomination.toString()"/>
            </li>
        </ul>
    </div>
</template>

<script>
    import Chip from "./Chip";
    export default {
        name: "Chips",
        components: {
          Chip
        },
        data(){
            return{
                denominations :[1,5,10,25,50,100,500,1000],
            }
        }
    }
</script>

