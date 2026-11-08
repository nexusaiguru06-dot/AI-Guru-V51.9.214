export type CurriculumCase = {
  id: string;
  board: 'Kerala' | 'CBSE';
  grade: number;
  topic: string;
  domain: string;
  prompt: string;
  expectedVisualKinds: string[];
  minNodes?: number;
  minEvents?: number;
};

const c = (id:string, board:'Kerala'|'CBSE', grade:number, topic:string, domain:string, prompt:string, expectedVisualKinds:string[], minNodes=2):CurriculumCase => ({
  id, board, grade, topic, domain, prompt, expectedVisualKinds, minNodes, minEvents: 2,
});

export const CURRICULUM_CASES: CurriculumCase[] = [
  c('g01-addition','Kerala',1,'Addition','arithmetic','Add 7 + 5',['latex','shape','text']),
  c('g01-shapes','CBSE',1,'Shapes','geometry','Identify a triangle and its three sides',['shape','text']),
  c('g02-multiplication','Kerala',2,'Multiplication','arithmetic','211 × 3',['latex','line','shape']),
  c('g02-fractions','CBSE',2,'Fractions','fractions','Show 3/4 using equal parts',['shape','text']),
  c('g03-place-value','Kerala',3,'Place value','arithmetic','Explain 405 as 4 hundreds, 0 tens and 5 ones',['latex','text']),
  c('g03-perimeter','CBSE',3,'Perimeter','mensuration','Find the perimeter of a rectangle of length 8 cm and breadth 5 cm',['shape','latex']),
  c('g04-decimals','Kerala',4,'Decimals','decimals_percentages','Compare 0.7 and 0.65',['latex','text','line']),
  c('g04-ratio','CBSE',4,'Ratio','ratio_proportion','Simplify the ratio 12:18',['shape','text']),
  c('g05-percentage','Kerala',5,'Percentage','decimals_percentages','Find 25% of 200',['shape','latex']),
  c('g05-area','CBSE',5,'Area','mensuration','Find the area of a rectangle 12 cm by 7 cm',['shape','latex']),
  c('g06-integers','Kerala',6,'Integers','arithmetic','Show -3 + 7 on a number line',['line','point','latex']),
  c('g06-fractions','CBSE',6,'Fraction multiplication','fractions','Calculate 2/3 × 3/4',['shape','latex']),
  c('g07-linear','Kerala',7,'Linear equation','linear_equations','Solve 3x + 5 = 20',['latex','arrow','transform']),
  c('g07-proportion','CBSE',7,'Proportion','ratio_proportion','If 4 pens cost 60, find the cost of 10 pens',['shape','arrow']),
  c('g08-algebra','Kerala',8,'Algebraic expressions','algebra','Simplify 3x + 2x - 4',['latex','transform']),
  c('g08-pythagoras','CBSE',8,'Pythagoras theorem','geometry','For a right triangle with legs 6 and 8, find the hypotenuse',['shape','latex']),
  c('g09-polynomial','Kerala',9,'Factorisation','polynomials','Factorise x² - 5x + 6',['latex','transform','arrow']),
  c('g09-coordinate','CBSE',9,'Coordinate geometry','coordinate_geometry','Plot the point (3, -2)',['line','point','latex']),
  c('g10-sequence','Kerala',10,'Arithmetic progression','sequences_series','Find the 10th term of 3, 7, 11, 15, ...',['shape','text','arrow']),
  c('g10-trigonometry','CBSE',10,'Trigonometry','trigonometry','Explain sin 30° = 1/2 using a right triangle',['shape','latex','graph']),
  c('g10-circle','Kerala',10,'Circle theorem','geometry','Explain that the angle in a semicircle is 90 degrees',['shape','text']),
  c('g11-functions','CBSE',11,'Functions','functions','Plot f(x) = x² for -2 ≤ x ≤ 2',['graph','latex']),
  c('g11-complex','Kerala',11,'Complex numbers','complex_numbers','Represent z = 3 + 2i on the Argand plane',['line','point','arrow','latex']),
  c('g11-matrices','CBSE',11,'Matrices','matrices','Add [[1,2],[3,4]] and [[5,6],[7,8]]',['shape','latex','text']),
  c('g11-probability','Kerala',11,'Probability','probability','Find the probability of getting an even number on a fair die',['shape','text','latex']),
  c('g12-calculus','CBSE',12,'Derivative','calculus','Find d/dx (x² + 3x)',['graph','latex','transform']),
  c('g12-integral','Kerala',12,'Integration','calculus','Find ∫ 2x dx',['graph','latex','transform']),
  c('g12-statistics','CBSE',12,'Statistics','statistics','Find the mean of 2, 4, 6, 8, 10',['shape','text','latex']),
  c('g12-vectors','Kerala',12,'Vectors','vectors','Represent vector v = (3,4) and find its magnitude',['arrow','point','latex']),
  c('g12-3d','CBSE',12,'3D geometry','3d_geometry','Explain the distance between two points in three dimensions',['shape','line','latex']),
  c('g12-finance','Kerala',12,'Financial mathematics','financial_math','Calculate simple interest on ₹5000 at 8% per year for 2 years',['shape','arrow','latex']),
];
