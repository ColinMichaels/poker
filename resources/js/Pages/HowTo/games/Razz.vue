<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div>
                <h2 class="text-4xl font-black">Razz:</h2>
                <p>The lowest hand wins the pot. The format is similar to seven-card stud high, except the high card (aces are low) is required to make the forced bet on the first round, and the low hand acts first on all subsequent rounds. Straights and flushes have no ranking, so the best possible hand is 5-4-3-2-A (a wheel). An open pair does not affect the betting limit.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>

            </div>
        </template>
        <template v-slot:rules>
            <div>
                <strong>Rules of Razz</strong>
                <ul class="numbered">
                    <li>All seven-card stud rules apply in razz except as otherwise noted.</li>
                    <li>The lowest hand wins the pot. Aces are low, and straights and flushes have no effect on the low value of a hand. The best possible hand is 5-4-3-2-A.</li>
                    <li>The highest card by suit starts the action with a forced bet. The low hand acts first on all subsequent rounds. If the low hand is tied, the first player clockwise from the dealer starts the action.</li>
                    <li>Fixed-limit games use the lower limit on third and fourth streets and the upper limit on subsequent streets. An open pair does not affect the limit.</li>
                    <li>The dealer announces all pairs the first time they occur, except pairs of face cards, which are never announced.</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";
    export default {
        name: "Razz",
        components:{
            GameRules
        },
        data(){
            return{
                name : "Razz"
            }
        }
    }
</script>
