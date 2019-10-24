<?php
namespace Poker;

class Player extends Game
{

	public $name,$hand, $score, $wallet, $is_current;

	public function __construct(Deck $deck) {

		parent::__construct();
		$this->hand = $deck->draw(5);
		$this->wallet = 100;
		$this->score = 0;
		$this->is_current = false;

	}

	public function score(){

		return array_sum($this->hand);
	}

	public function getWallet(){
		return $this->wallet;
	}

	public function withdraw($amount){

		 return  $this->wallet -= $amount;

	}

}
