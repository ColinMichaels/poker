<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div>
                <h2 class="text-4xl font-black">Mississippi Stud:</h2>
                <p>The best five-card poker hand, out of seven cards, wins the pot.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>
                <strong>Big-Bet Betting Structures</strong>
                <br>
                <br>
                Half-pot, pot-limit and no-limit betting. In big-bet (that is, non-limit) games, all forms of stud require an ante from each player, with the highest card or hand acting first in all rounds of play. In the first round, the high card must either bet or fold. In later rounds, the high hand can either bet or check. The initial bet size is at the discretion of the opener and can usually be as small as one ante, or up to the maximum bet size allowed in the form used, that is, half the total antes in half-pot, the total antes in full-pot and as much as you wish in no-limit.
                <br>
                <br>
                <strong>Limit Betting Structures</strong>
                <br>
                <br>
                There is an ante, a compulsory bring-in from the low card, and bets typically double for the last two rounds, though this can be varied according to player's tastes. The bets are usually capped at three per round, except in head-to-head pots.
                <br>
                <br>
                <ul class="numbered">
                    <li>
                        <strong>Low ante games:</strong>
                        Ante, one unit; bring-in, two units, complete, 10 units. The maximum bet for the first two rounds is 10 units. Bets double to 20 units for the third and fourth rounds.
                    </li>
                    <li>
                        <strong>High ante:</strong>
                        Ante, four units; bring-in, five units; raise, 10 units. Bets double to 20 units for the third and fourth rounds.
                    </li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";
    export default {
        name: "MississippiStud",
        components:{
            GameRules,
            Card
        },
        data(){
            return{
                name: "MississippiStud"
            }
        }
    }
</script>
