<?php
namespace Poker;

class Player extends Game
{

	public $name,$hand, $wallet;

	public function __construct() {
		$this->hand = new Hand();
		$this->wallet = rand(5,10000);
        parent::__construct();

	}

	public function chips(){

         return (new Chip($this->wallet))->split();

    }

	public function getWallet(){
		return $this->wallet;
	}

	public function withdraw($amount){

		 return  $this->wallet -= $amount;

	}

    public function draw($card){
       $this->hand->addCardToHand($card);
    }

}
