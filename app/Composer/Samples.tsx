const EXAMPLES = [
  'Write me an email to .... with .... - don’t mention ..... - make sure to',
  'Hi John, I’d love to make it to Saturday dinner. Shall we do it next week at 2 pm?',
  'I need a very casual email asking my friend Donna to lunch next week, make it short.',
];

function Samples() {
  return (
    <div className="py-10">
      {EXAMPLES.map((o) => (
        <div key={o} className="py-5">
          {o} <hr />
        </div>
      ))}
    </div>
  );
}

export default Samples;
